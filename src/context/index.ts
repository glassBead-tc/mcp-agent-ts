/**
 * Context management for MCP Agent
 */
import { trace, TracerProvider, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { TextMapPropagator } from '@opentelemetry/api';

import { getSettings, Settings } from '../config';
import { LoggingConfig } from '../logging/logger';
import { EventFilter } from '../logging/events';
import { createTransport } from '../logging/transport';
import { ServerRegistry } from '../mcp/server_registry';
import { Executor } from '../executor/executor';
import { AsyncioExecutor } from '../executor/asyncio_executor';
import { DecoratorRegistry } from '../executor/decorator_registry';
import { ActivityRegistry } from '../executor/task_registry';
import { HumanInputCallback, SignalWaitCallback } from '../types';
import { ModelSelector } from '../workflows/llm/model_selector';

// Import temporal executor conditionally
let TemporalExecutor: any;
try {
  // This will be dynamically imported if temporal is available
  TemporalExecutor = null;
} catch (error) {
  // Temporal is not available, which is fine
}

/**
 * Context class for storing global application state
 */
export class Context {
  config: Settings;
  executor?: Executor;
  humanInputHandler?: HumanInputCallback;
  signalNotification?: SignalWaitCallback;
  modelSelector?: ModelSelector;
  
  // Registries
  serverRegistry: ServerRegistry;
  taskRegistry: ActivityRegistry;
  decoratorRegistry: DecoratorRegistry;
  
  tracer?: trace.Tracer;
  
  // Additional properties
  [key: string]: any;
  
  constructor(config?: Settings) {
    this.config = config || getSettings();
    this.serverRegistry = new ServerRegistry(this.config);
    this.taskRegistry = new ActivityRegistry();
    this.decoratorRegistry = new DecoratorRegistry();
  }
}

// Global context instance
let _globalContext: Context | null = null;

/**
 * Configure OpenTelemetry based on application config
 */
async function configureOtel(config: Settings): Promise<trace.Tracer | undefined> {
  if (!config.otel.enabled) {
    return undefined;
  }
  
  const serviceName = config.otel.service_name;
  const serviceInstanceId = config.otel.service_instance_id;
  const serviceVersion = config.otel.service_version;
  
  // Create resource identifying this service
  const resource = Resource.default().merge(
    new Resource({
      'service.name': serviceName,
      ...(serviceInstanceId ? { 'service.instance.id': serviceInstanceId } : {}),
      ...(serviceVersion ? { 'service.version': serviceVersion } : {}),
    })
  );
  
  // Create provider with resource
  const tracerProvider = new TracerProvider({ resource });
  
  // Add exporters based on config
  const otlpEndpoint = config.otel.otlp_endpoint;
  if (otlpEndpoint) {
    const exporter = new OTLPTraceExporter({ url: otlpEndpoint });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
    
    if (config.otel.console_debug) {
      tracerProvider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
    }
  } else {
    // Default to console exporter in development
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
  }
  
  // Register as global tracer provider
  trace.setGlobalTracerProvider(tracerProvider);
  
  // Return a tracer for the service
  return trace.getTracer(serviceName);
}

/**
 * Configure logging based on application config
 */
async function configureLogger(config: Settings): Promise<void> {
  const eventFilter = new EventFilter(config.logger.level);
  const transport = createTransport(config.logger, eventFilter);
  
  await LoggingConfig.configure({
    level: config.logger.level,
    format: config.logger.format,
    transport,
    batch_size: config.logger.batch_size,
    flush_interval: config.logger.flush_interval,
  });
}

/**
 * Configure usage telemetry
 */
async function configureUsageTelemetry(_config: Settings): Promise<void> {
  // TODO: Implement usage tracking
}

/**
 * Configure the executor based on application config
 */
async function configureExecutor(config: Settings): Promise<Executor> {
  if (config.execution_engine === 'temporal' && TemporalExecutor) {
    // Configure Temporal executor if available
    return new TemporalExecutor(config.temporal);
  } else {
    // Default to asyncio executor
    return new AsyncioExecutor();
  }
}

/**
 * Initialize the global application context
 */
export async function initializeContext(
  config?: Settings,
  storeGlobally: boolean = false
): Promise<Context> {
  const settings = config || getSettings();
  
  const context = new Context(settings);
  
  // Configure logging and telemetry
  context.tracer = await configureOtel(settings);
  await configureLogger(settings);
  await configureUsageTelemetry(settings);
  
  // Configure the executor
  context.executor = await configureExecutor(settings);
  
  if (storeGlobally) {
    _globalContext = context;
  }
  
  return context;
}

/**
 * Clean up the global application context
 */
export async function cleanupContext(): Promise<void> {
  // Shutdown logging and telemetry
  await LoggingConfig.shutdown();
  
  // Clean up global context
  _globalContext = null;
}

/**
 * Get the current global context
 */
export function getCurrentContext(): Context {
  if (!_globalContext) {
    // Initialize synchronously if not already initialized
    _globalContext = new Context();
    
    // Schedule async initialization
    initializeContext(undefined, true).catch(error => {
      console.error('Failed to initialize context:', error);
    });
  }
  
  return _globalContext;
}

/**
 * Get the current application config
 */
export function getCurrentConfig(): Settings {
  return getCurrentContext().config || getSettings();
}

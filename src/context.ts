/**
 * Context module for MCP Agent
 * Provides global context and state management for the application
 */
import { Settings, getSettings } from "./config.js";
import { getLogger } from "./logging/logger.js";
import { HumanInputCallback } from "./types.js";
import { SignalWaitCallback } from "./executor/workflow_signal.js";
import { ModelSelector } from "./workflows/llm/model_selector.js";
import { ServerRegistry } from "./mcp/server_registry.js";
import { MCPConnectionManager } from "./mcp/mcp_connection_manager.js";

const logger = getLogger("context");

// Global context instance
let _currentContext: Context | undefined;

/**
 * Task metadata interface
 */
export interface TaskMetadata {
  activity_name: string;
  schedule_to_close_timeout: number;
  retry_policy?: Record<string, any>;
  [key: string]: any;
}

/**
 * Task Registry interface
 */
export interface TaskRegistry {
  register: (name: string, fn: Function, metadata: TaskMetadata) => void;
  get: (name: string) => Function | undefined;
  listActivities: () => string[];
}

/**
 * Task registry implementation
 */
class TaskRegistryImpl implements TaskRegistry {
  private registry = new Map<
    string,
    { fn: Function; metadata: TaskMetadata }
  >();

  register(name: string, fn: Function, metadata: TaskMetadata): void {
    this.registry.set(name, { fn, metadata });
  }

  get(name: string): Function | undefined {
    return this.registry.get(name)?.fn;
  }

  listActivities(): string[] {
    return Array.from(this.registry.keys());
  }
}

/**
 * Decorator Registry interface
 */
export interface DecoratorRegistry {
  getWorkflowDefnDecorator: (
    engine: any
  ) => ((cls: any, options: any) => any) | undefined;
  getWorkflowRunDecorator: (
    engine: any
  ) =>
    | (<T>(
        fn: (...args: any[]) => Promise<T>
      ) => (...args: any[]) => Promise<T>)
    | undefined;
}

/**
 * Executor interface
 */
export interface Executor {
  executionEngine: any;
}

/**
 * Application context
 * Contains all global state and resources for the application
 */
export class Context {
  public config: Settings;
  public humanInputHandler?: HumanInputCallback;
  public signalNotification?: SignalWaitCallback;
  public modelSelector?: ModelSelector;
  public serverRegistry: ServerRegistry;
  public connectionManager: MCPConnectionManager;
  public taskRegistry: any; // Will be initialized later
  public decoratorRegistry: any; // Will be initialized later
  public executor?: any; // Will be initialized later

  constructor(config: Settings) {
    this.config = config;
    this.serverRegistry = new ServerRegistry(config.mcp?.servers || {});
    this.connectionManager = new MCPConnectionManager(this.serverRegistry);
  }

  /**
   * Initialize the context
   */
  async initialize(): Promise<void> {
    logger.info("Initializing context");

    // Initialize any required resources
    // Note: Add initialization code here as needed

    logger.info("Context initialized");
  }

  /**
   * Clean up the context
   */
  async cleanup(): Promise<void> {
    logger.info("Cleaning up context");

    // Close any open connections or resources
    await this.connectionManager.close();

    logger.info("Context cleanup complete");
  }
}

/**
 * Initialize the application context
 */
export async function initializeContext(config?: Settings): Promise<Context> {
  // Use provided config or get default settings
  const settings = config || getSettings();

  // Create new context
  const context = new Context(settings);

  // Initialize context
  await context.initialize();

  // Set global context
  _currentContext = context;

  return context;
}

/**
 * Clean up the application context
 */
export async function cleanupContext(): Promise<void> {
  if (_currentContext) {
    await _currentContext.cleanup();
    _currentContext = undefined;
  }
}

/**
 * Get the current application context
 */
export function getCurrentContext(): Context {
  if (!_currentContext) {
    throw new Error("No active context found. Call initializeContext() first.");
  }
  return _currentContext;
}

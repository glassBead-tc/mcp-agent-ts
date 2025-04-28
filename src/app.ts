/**
 * Main application class for MCP Agent
 */
import { Context, initializeContext, cleanupContext } from './context.js';
import { Settings, getSettings } from './config.js';
import { getLogger } from './logging/logger.js';
import { HumanInputCallback } from './types.js';
import { consoleInputCallback } from './human_input/handler.js';
import { SignalWaitCallback, consoleSignalNotification } from './executor/workflow_signal.js';
import { ModelSelector } from './workflows/llm/model_selector.js';
import { Workflow } from './executor/workflow.js';

const logger = getLogger('app');

/**
 * Main application class
 */
export class MCPApp {
  private name: string;
  private _config?: Settings;
  private _humanInputCallback?: HumanInputCallback;
  private _signalNotification?: SignalWaitCallback;
  private _modelSelector?: ModelSelector;
  private _workflows: Map<string, any> = new Map();
  private _logger = logger;
  private _context?: Context;
  private _initialized = false;
  
  /**
   * Create a new application
   */
  constructor(
    options: {
      name?: string;
      settings?: Settings;
      humanInputCallback?: HumanInputCallback;
      signalNotification?: SignalWaitCallback;
      modelSelector?: ModelSelector;
    } = {}
  ) {
    this.name = options.name || 'mcp_application';
    this._config = options.settings;
    this._humanInputCallback = options.humanInputCallback || consoleInputCallback;
    this._signalNotification = options.signalNotification || consoleSignalNotification;
    this._modelSelector = options.modelSelector;
  }
  
  /**
   * Get the application context
   */
  get context(): Context {
    if (!this._context) {
      throw new Error('MCPApp not initialized, please call initialize() first, or use async with app.run().');
    }
    return this._context;
  }
  
  /**
   * Get the application config
   */
  get config(): Settings {
    return this.context.config;
  }
  
  /**
   * Get the server registry
   */
  get serverRegistry() {
    return this.context.serverRegistry;
  }
  
  /**
   * Get the executor
   */
  get executor() {
    return this.context.executor!;
  }
  
  /**
   * Get the execution engine
   */
  get engine() {
    return this.executor.executionEngine;
  }
  
  /**
   * Get the workflows
   */
  get workflows() {
    return this._workflows;
  }
  
  /**
   * Get the tasks
   */
  get tasks() {
    return this.context.taskRegistry.listActivities();
  }
  
  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }
    
    this._context = await initializeContext(this._config);
    
    // Set the properties that were passed in the constructor
    this._context.humanInputHandler = this._humanInputCallback;
    this._context.signalNotification = this._signalNotification;
    this._context.modelSelector = this._modelSelector;
    
    this._initialized = true;
    this._logger.info('MCPAgent initialized');
  }
  
  /**
   * Clean up application resources
   */
  async cleanup(): Promise<void> {
    if (!this._initialized) {
      return;
    }
    
    await cleanupContext();
    this._context = undefined;
    this._initialized = false;
  }
  
  /**
   * Run the application
   */
  async run<T>(callback: (app: MCPApp) => Promise<T>): Promise<T> {
    await this.initialize();
    try {
      return await callback(this);
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Workflow decorator
   */
  workflow<T extends new (...args: any[]) => any>(
    cls: T,
    options: {
      workflowId?: string;
      [key: string]: any;
    } = {}
  ): T {
    const decoratorRegistry = this.context.decoratorRegistry;
    const executionEngine = this.engine;
    const workflowDefnDecorator = decoratorRegistry.getWorkflowDefnDecorator(executionEngine);
    
    if (workflowDefnDecorator) {
      return workflowDefnDecorator(cls, options);
    }
    
    // Store reference to app
    (cls as any)._app = this;
    
    // Register workflow
    this._workflows.set(options.workflowId || cls.name, cls);
    
    return cls;
  }
  
  /**
   * Workflow run decorator
   */
  workflowRun<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
    const decoratorRegistry = this.context.decoratorRegistry;
    const executionEngine = this.engine;
    const workflowRunDecorator = decoratorRegistry.getWorkflowRunDecorator(executionEngine);
    
    if (workflowRunDecorator) {
      return workflowRunDecorator(fn);
    }
    
    // Default no-op wrapper
    return fn;
  }
  
  /**
   * Workflow task decorator
   */
  workflowTask<T>(
    options: {
      name?: string;
      scheduleToCloseTimeout?: number;
      retryPolicy?: {
        maximumAttempts?: number;
        initialInterval?: number;
        maximumInterval?: number;
        backoffCoefficient?: number;
        nonRetryableErrorTypes?: string[];
      };
      [key: string]: any;
    } = {}
  ): (target: (...args: any[]) => Promise<T>) => (...args: any[]) => Promise<T> {
    return (target: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> => {
      // Check if function is async
      if (!target.constructor.name.includes('AsyncFunction')) {
        throw new TypeError(`Function ${target.name} must be async.`);
      }
      
      const actualName = options.name || `${target.name}`;
      const timeout = options.scheduleToCloseTimeout || 600; // 10 minutes default
      const metadata = {
        activity_name: actualName,
        schedule_to_close_timeout: timeout,
        retry_policy: options.retryPolicy || {},
        ...options,
      };
      
      // Register with activity registry
      const activityRegistry = this.context.taskRegistry;
      activityRegistry.register(actualName, target, metadata);
      
      // Add metadata to function
      (target as any).is_workflow_task = true;
      (target as any).execution_metadata = metadata;
      
      return target;
    };
  }
  
  /**
   * Check if a function is a workflow task
   */
  isWorkflowTask(fn: Function): boolean {
    return !!(fn as any).is_workflow_task;
  }
}

/**
 * AsyncIO-based executor implementation
 */
import { Executor } from './executor.js';
import { getLogger } from '../logging/logger.js';

const logger = getLogger('asyncio_executor');

/**
 * AsyncIO-based executor implementation
 */
export class AsyncioExecutor implements Executor {
  private activities: Map<string, Function> = new Map();
  private workflows: Map<string, any> = new Map();
  private signals: Map<string, { resolver: (value: any) => void; timeout?: NodeJS.Timeout }> = new Map();
  
  /**
   * Register an activity function
   */
  registerActivity(name: string, fn: Function): void {
    this.activities.set(name, fn);
  }
  
  /**
   * Register a workflow
   */
  registerWorkflow(name: string, workflowClass: any): void {
    this.workflows.set(name, workflowClass);
  }
  
  /**
   * Execute a workflow
   */
  async executeWorkflow<T>(
    workflowType: string,
    args: any[] = [],
    options: { workflowId?: string; taskQueue?: string; [key: string]: any } = {}
  ): Promise<T> {
    logger.debug(`Executing workflow ${workflowType}`, { workflowType, args, options });
    
    const WorkflowClass = this.workflows.get(workflowType);
    if (!WorkflowClass) {
      throw new Error(`Workflow ${workflowType} not found`);
    }
    
    try {
      const workflow = new WorkflowClass(...args);
      return await workflow.run();
    } catch (error) {
      logger.error(`Error executing workflow ${workflowType}`, { error });
      throw error;
    }
  }
  
  /**
   * Execute an activity
   */
  async executeActivity<T>(
    activityType: string,
    args: any[] = [],
    options: {
      taskQueue?: string;
      scheduleToCloseTimeout?: number;
      retryPolicy?: any;
      [key: string]: any;
    } = {}
  ): Promise<T> {
    logger.debug(`Executing activity ${activityType}`, { activityType, args, options });
    
    const activity = this.activities.get(activityType);
    if (!activity) {
      throw new Error(`Activity ${activityType} not found`);
    }
    
    try {
      return await activity(...args);
    } catch (error) {
      logger.error(`Error executing activity ${activityType}`, { error });
      throw error;
    }
  }
  
  /**
   * Send a signal to a workflow
   */
  async signal(
    signalName: string,
    payload: any,
    options: { workflowId?: string; [key: string]: any } = {}
  ): Promise<void> {
    logger.debug(`Sending signal ${signalName}`, { signalName, payload, options });
    
    const signalHandler = this.signals.get(signalName);
    if (signalHandler) {
      // Clear any timeout
      if (signalHandler.timeout) {
        clearTimeout(signalHandler.timeout);
      }
      
      // Resolve the promise
      signalHandler.resolver(payload);
      
      // Remove the signal handler
      this.signals.delete(signalName);
    } else {
      logger.warn(`No handler found for signal ${signalName}`);
    }
  }
  
  /**
   * Wait for a signal
   */
  async waitForSignal<T>(
    signalName: string,
    options: {
      workflowId?: string;
      requestId?: string;
      signalDescription?: string;
      timeout_seconds?: number;
      signalType?: any;
      [key: string]: any;
    } = {}
  ): Promise<T> {
    logger.debug(`Waiting for signal ${signalName}`, { signalName, options });
    
    return new Promise<T>((resolve, reject) => {
      // Set up timeout if specified
      let timeout: NodeJS.Timeout | undefined;
      if (options.timeout_seconds) {
        timeout = setTimeout(() => {
          this.signals.delete(signalName);
          reject(new Error(`Timeout waiting for signal ${signalName}`));
        }, options.timeout_seconds * 1000);
      }
      
      // Store the resolver
      this.signals.set(signalName, { resolver: resolve, timeout });
    });
  }
  
  /**
   * Get the execution engine type
   */
  get executionEngine(): string {
    return 'asyncio';
  }
}

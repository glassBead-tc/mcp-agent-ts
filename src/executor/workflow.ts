/**
 * Workflow base class for MCP Agent
 */
import { v4 as uuidv4 } from 'uuid';
import { getCurrentContext } from '../context';
import { getLogger } from '../logging/logger';

const logger = getLogger('workflow');

/**
 * Generic workflow interface
 */
export interface Workflow<T> {
  execute(...args: any[]): Promise<T>;
  run(...args: any[]): Promise<T>;
}

/**
 * Base workflow class
 */
export abstract class BaseWorkflow<T> implements Workflow<T> {
  protected workflowId: string;
  protected app: any; // Reference to the MCPApp instance
  
  constructor() {
    this.workflowId = uuidv4();
  }
  
  /**
   * Execute the workflow
   */
  async execute(...args: any[]): Promise<T> {
    logger.debug(`Executing workflow ${this.constructor.name}`, { args });
    
    try {
      return await this.run(...args);
    } catch (error) {
      logger.error(`Error executing workflow ${this.constructor.name}`, { error });
      throw error;
    }
  }
  
  /**
   * Run the workflow (to be implemented by subclasses)
   */
  abstract run(...args: any[]): Promise<T>;
  
  /**
   * Execute an activity
   */
  protected async executeActivity<R>(
    activityName: string,
    ...args: any[]
  ): Promise<R> {
    const context = getCurrentContext();
    if (!context.executor) {
      throw new Error('Executor not initialized');
    }
    
    return context.executor.executeActivity<R>(activityName, args);
  }
  
  /**
   * Send a signal
   */
  protected async signal(
    signalName: string,
    payload: any,
    options: { workflowId?: string } = {}
  ): Promise<void> {
    const context = getCurrentContext();
    if (!context.executor) {
      throw new Error('Executor not initialized');
    }
    
    return context.executor.signal(signalName, payload, {
      workflowId: options.workflowId || this.workflowId,
    });
  }
  
  /**
   * Wait for a signal
   */
  protected async waitForSignal<R>(
    signalName: string,
    options: {
      workflowId?: string;
      requestId?: string;
      signalDescription?: string;
      timeout_seconds?: number;
      signalType?: any;
    } = {}
  ): Promise<R> {
    const context = getCurrentContext();
    if (!context.executor) {
      throw new Error('Executor not initialized');
    }
    
    return context.executor.waitForSignal<R>(signalName, {
      workflowId: options.workflowId || this.workflowId,
      requestId: options.requestId || uuidv4(),
      signalDescription: options.signalDescription,
      timeout_seconds: options.timeout_seconds,
      signalType: options.signalType,
    });
  }
}

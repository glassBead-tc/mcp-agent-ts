/**
 * Decorator registry for MCP Agent
 */
import { getLogger } from '../logging/logger';

const logger = getLogger('decorator_registry');

/**
 * Type for workflow definition decorator
 */
export type WorkflowDefnDecorator = <T extends new (...args: any[]) => any>(
  target: T,
  ...args: any[]
) => T;

/**
 * Type for workflow run decorator
 */
export type WorkflowRunDecorator = <T>(
  target: (...args: any[]) => Promise<T>,
) => (...args: any[]) => Promise<T>;

/**
 * Decorator registry for managing decorators
 */
export class DecoratorRegistry {
  private workflowDefnDecorators: Map<string, WorkflowDefnDecorator> = new Map();
  private workflowRunDecorators: Map<string, WorkflowRunDecorator> = new Map();
  
  /**
   * Register a workflow definition decorator
   */
  registerWorkflowDefnDecorator(engine: string, decorator: WorkflowDefnDecorator): void {
    logger.debug(`Registering workflow definition decorator for engine ${engine}`);
    this.workflowDefnDecorators.set(engine, decorator);
  }
  
  /**
   * Register a workflow run decorator
   */
  registerWorkflowRunDecorator(engine: string, decorator: WorkflowRunDecorator): void {
    logger.debug(`Registering workflow run decorator for engine ${engine}`);
    this.workflowRunDecorators.set(engine, decorator);
  }
  
  /**
   * Get a workflow definition decorator for an engine
   */
  getWorkflowDefnDecorator(engine: string): WorkflowDefnDecorator | undefined {
    return this.workflowDefnDecorators.get(engine);
  }
  
  /**
   * Get a workflow run decorator for an engine
   */
  getWorkflowRunDecorator(engine: string): WorkflowRunDecorator | undefined {
    return this.workflowRunDecorators.get(engine);
  }
}

/**
 * Register asyncio decorators
 */
export function registerAsyncioDecorators(registry: DecoratorRegistry): void {
  // For asyncio, we use no-op decorators
  registry.registerWorkflowDefnDecorator('asyncio', (cls) => cls);
  registry.registerWorkflowRunDecorator('asyncio', (fn) => fn);
}

/**
 * Register temporal decorators if available
 */
export function registerTemporalDecorators(registry: DecoratorRegistry): void {
  try {
    // Try to import temporal
    // const { workflow } = require('@temporalio/workflow');
    
    // Register temporal decorators
    // registry.registerWorkflowDefnDecorator('temporal', workflow.defn);
    // registry.registerWorkflowRunDecorator('temporal', workflow.run);
    
    // For now, use no-op decorators
    registry.registerWorkflowDefnDecorator('temporal', (cls) => cls);
    registry.registerWorkflowRunDecorator('temporal', (fn) => fn);
  } catch (error) {
    // Temporal is not available, use no-op decorators
    registry.registerWorkflowDefnDecorator('temporal', (cls) => cls);
    registry.registerWorkflowRunDecorator('temporal', (fn) => fn);
  }
}

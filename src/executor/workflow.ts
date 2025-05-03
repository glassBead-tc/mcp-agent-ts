/**
 * Workflow module for MCP Agent
 * Provides base workflow definition and interface
 */
import { getLogger } from "../logging/logger.js";

const logger = getLogger("workflow");

/**
 * Workflow state
 */
export enum WorkflowState {
  CREATED = "created",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Workflow options
 */
export interface WorkflowOptions {
  id?: string;
  name?: string;
  description?: string;
  [key: string]: any;
}

/**
 * Workflow result
 */
export interface WorkflowResult<T = any> {
  id: string;
  state: WorkflowState;
  result?: T;
  error?: Error;
  startTime?: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  workflowId: string;
  runId: string;
  [key: string]: any;
}

/**
 * Legacy Base Workflow class for MCP Agent
 * @deprecated Use the generic Workflow class instead
 */
export class BaseWorkflow {
  protected name: string;
  protected description: string;
  protected options: WorkflowOptions;
  protected context?: WorkflowExecutionContext;
  protected logger = logger;

  /**
   * Create a new workflow
   */
  constructor(options: WorkflowOptions = {}) {
    this.name = options.name || this.constructor.name;
    this.description = options.description || "";
    this.options = options;
  }

  /**
   * Get workflow name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get workflow description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Set execution context
   */
  setContext(context: WorkflowExecutionContext): void {
    this.context = context;
  }

  /**
   * Get execution context
   */
  getContext(): WorkflowExecutionContext | undefined {
    return this.context;
  }

  /**
   * Run workflow
   * This method should be implemented by subclasses
   */
  async run(...args: any[]): Promise<any> {
    throw new Error("Method not implemented");
  }
}

/**
 * Base workflow class
 */
export class Workflow<TInput = any, TOutput = any> {
  protected id: string;
  protected name: string;
  protected description: string;
  protected state: WorkflowState = WorkflowState.CREATED;
  protected result?: TOutput;
  protected error?: Error;
  protected startTime?: Date;
  protected endTime?: Date;
  protected metadata: Record<string, any> = {};
  protected logger: ReturnType<typeof getLogger>;

  constructor(options: WorkflowOptions = {}) {
    this.id =
      options.id ||
      `workflow-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.name = options.name || this.constructor.name;
    this.description = options.description || "";
    this.logger = getLogger(`workflow:${this.name}`);

    // Copy additional options to metadata
    Object.entries(options).forEach(([key, value]) => {
      if (!["id", "name", "description"].includes(key)) {
        this.metadata[key] = value;
      }
    });
  }

  /**
   * Get workflow ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get workflow name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get workflow description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Get workflow state
   */
  getState(): WorkflowState {
    return this.state;
  }

  /**
   * Get workflow result
   */
  getResult(): WorkflowResult<TOutput> {
    return {
      id: this.id,
      state: this.state,
      result: this.result,
      error: this.error,
      startTime: this.startTime,
      endTime: this.endTime,
      metadata: this.metadata,
    };
  }

  /**
   * Execute the workflow
   * Override this method in derived classes
   */
  async execute(input: TInput): Promise<TOutput> {
    this.logger.debug("Executing workflow", { input });
    this.state = WorkflowState.RUNNING;
    this.startTime = new Date();

    try {
      // Call the run method
      this.result = await this.run(input);
      this.state = WorkflowState.COMPLETED;
      this.endTime = new Date();
      this.logger.debug("Workflow completed", { result: this.result });
      return this.result;
    } catch (error) {
      this.state = WorkflowState.FAILED;
      this.error = error instanceof Error ? error : new Error(String(error));
      this.endTime = new Date();
      this.logger.error("Workflow failed", { error });
      throw this.error;
    }
  }

  /**
   * Run the workflow implementation
   * Override this method in derived classes
   */
  protected async run(input: TInput): Promise<TOutput> {
    throw new Error("Method not implemented. Override in derived class.");
  }

  /**
   * Cancel the workflow
   */
  async cancel(): Promise<void> {
    if (this.state === WorkflowState.RUNNING) {
      this.state = WorkflowState.CANCELLED;
      this.endTime = new Date();
      this.logger.info("Workflow cancelled");
    }
  }
}

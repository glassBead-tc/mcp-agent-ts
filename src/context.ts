/**
 * Context for MCP Agent
 *
 * The Context provides shared resources and services to all components.
 */
import { HumanInputCallback } from "./types.js";

/**
 * Executor interface for handling signals
 */
export interface Executor {
  signal(signalName: string, data: any): Promise<void>;
  waitForSignal<T>(
    signalName: string,
    options?: {
      requestId?: string;
      workflowId?: string;
      signalDescription?: string;
      timeout_seconds?: number;
    }
  ): Promise<T>;
}

/**
 * Context class for MCP Agent
 *
 * Provides shared resources and services for all agent components.
 */
export class Context {
  executor?: Executor;
  humanInputHandler?: HumanInputCallback;

  /**
   * Create a new context
   *
   * @param options - Context options
   * @param options.executor - The executor for handling signals
   * @param options.humanInputHandler - Callback for handling human input requests
   */
  constructor(options?: {
    executor?: Executor;
    humanInputHandler?: HumanInputCallback;
  }) {
    this.executor = options?.executor;
    this.humanInputHandler = options?.humanInputHandler;
  }
}

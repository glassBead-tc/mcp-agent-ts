/**
 * Workflow signal handler module
 * Provides mechanisms for signaling between workflows and external systems
 */
import { getLogger } from "../logging/logger.js";

const logger = getLogger("workflow-signal");

// Declare the custom events to extend NodeJS.Process
declare global {
  namespace NodeJS {
    interface Process {
      emit(
        event: "mcp:signal",
        data: {
          signalName: string;
          value: any;
          metadata?: Record<string, any>;
          timestamp: Date;
        }
      ): boolean;
      on(
        event: "mcp:signal",
        listener: (data: {
          signalName: string;
          value: any;
          metadata?: Record<string, any>;
          timestamp: Date;
        }) => void
      ): this;
      removeListener(event: "mcp:signal", listener: Function): this;
    }
  }
}

/**
 * Signal wait callback interface
 * Used to handle waiting for signals and notifying workflows
 */
export interface SignalWaitCallback {
  waitForSignal: (
    signalName: string,
    options?: {
      timeout?: number;
      description?: string;
      metadata?: Record<string, any>;
    }
  ) => Promise<any>;

  notifySignal: (
    signalName: string,
    value: any,
    options?: {
      metadata?: Record<string, any>;
    }
  ) => Promise<void>;
}

/**
 * Signal state
 */
export interface SignalState {
  name: string;
  value?: any;
  status: "pending" | "received" | "timeout";
  createdAt: Date;
  completedAt?: Date;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Simple console-based signal notification implementation
 * This is a basic implementation that uses console prompts
 * For production use, consider implementing a proper UI or API for signal handling
 */
export const consoleSignalNotification: SignalWaitCallback = {
  /**
   * Wait for a signal
   */
  async waitForSignal(signalName: string, options = {}): Promise<any> {
    const { timeout = 0, description = "", metadata = {} } = options;

    logger.info(`Waiting for signal: ${signalName}`, {
      description,
      timeout: timeout > 0 ? `${timeout}ms` : "no timeout",
    });

    console.log(`\n[SIGNAL REQUIRED] ${signalName}`);
    if (description) {
      console.log(`Description: ${description}`);
    }

    return new Promise((resolve, reject) => {
      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          reject(new Error(`Signal wait timeout: ${signalName}`));
        }, timeout);
      }

      // For this simple implementation, we use a global event listener
      const handleSignal = (event: any) => {
        if (event.signalName === signalName) {
          // Clean up
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Remove the listener
          process.removeListener("mcp:signal", handleSignal);

          // Resolve with signal value
          resolve(event.value);
        }
      };

      // Add listener
      process.on("mcp:signal", handleSignal);
    });
  },

  /**
   * Notify a signal
   */
  async notifySignal(
    signalName: string,
    value: any,
    options = {}
  ): Promise<void> {
    const { metadata = {} } = options;

    logger.info(`Notifying signal: ${signalName}`, { metadata });

    // Emit event
    process.emit("mcp:signal", {
      signalName,
      value,
      metadata,
      timestamp: new Date(),
    });
  },
};

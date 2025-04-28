/**
 * Temporal based orchestrator for the MCP Agent.
 * Temporal provides durable execution and robust workflow orchestration,
 * as well as dynamic control flow, making it a good choice for an AI agent orchestrator.
 * Read more: https://docs.temporal.io/develop/typescript
 */

import { v4 as uuidv4 } from 'uuid';
import * as workflow from '@temporalio/workflow';
import { ConfigDict } from 'pydantic';
import { activity, ActivityOptions, defineQuery, defineSignal, defineUpdate, proxyActivities, RetryPolicy } from '@temporalio/workflow';
import { Client as TemporalClient, Worker } from '@temporalio/client';

import { Executor, ExecutorConfig, R } from './executor';
import { BaseSignalHandler, Signal, SignalHandler, SignalRegistration, SignalValueT } from './workflow_signal';
import { Context } from '../context';
import { TemporalSettings } from '../config';

class TemporalSignalHandler<T> extends BaseSignalHandler<T> {
  /**
   * Temporal-based signal handling using workflow signals
   */

  async waitForSignal(signal: Signal<T>, timeoutSeconds?: number): Promise<T> {
    if (!workflow.isReplaying()) {
      throw new Error('TemporalSignalHandler.wait_for_signal must be called from within a workflow');
    }

    const uniqueSignalName = `${signal.name}_${uuidv4()}`;
    const registration: SignalRegistration = {
      signalName: signal.name,
      uniqueName: uniqueSignalName,
      workflowId: workflow.workflowInfo().workflowId
    };

    // Container for signal value
    const container: { value: T | null; completed: boolean } = {
      value: null,
      completed: false
    };

    // Define the signal handler for this specific registration
    const signalHandler = defineSignal<[T]>(uniqueSignalName);
    workflow.setHandler(signalHandler, (value: T) => {
      container.value = value;
      container.completed = true;
    });

    await this._lock.runExclusive(async () => {
      // Register both the signal registration and handler atomically
      if (!this._pendingSignals[signal.name]) {
        this._pendingSignals[signal.name] = [];
      }
      this._pendingSignals[signal.name].push(registration);

      if (!this._handlers[signal.name]) {
        this._handlers[signal.name] = [];
      }
      this._handlers[signal.name].push([uniqueSignalName, signalHandler]);
    });

    try {
      // Wait for signal with optional timeout
      await workflow.condition(() => container.completed, timeoutSeconds ? timeoutSeconds * 1000 : undefined);
      return container.value!;
    } catch (e) {
      throw new Error(`Timeout waiting for signal ${signal.name}`);
    } finally {
      await this._lock.runExclusive(async () => {
        // Remove ourselves from _pendingSignals
        if (this._pendingSignals[signal.name]) {
          this._pendingSignals[signal.name] = this._pendingSignals[signal.name].filter(
            sr => sr.uniqueName !== uniqueSignalName
          );
          if (this._pendingSignals[signal.name].length === 0) {
            delete this._pendingSignals[signal.name];
          }
        }

        // Remove ourselves from _handlers
        if (this._handlers[signal.name]) {
          this._handlers[signal.name] = this._handlers[signal.name].filter(
            h => h[0] !== uniqueSignalName
          );
          if (this._handlers[signal.name].length === 0) {
            delete this._handlers[signal.name];
          }
        }
      });
    }
  }

  onSignal(signalName: string) {
    /**
     * Decorator to register a signal handler.
     */
    return (func: Function) => {
      // Create unique signal name for this handler
      const uniqueSignalName = `${signalName}_${uuidv4()}`;

      // Create the actual handler that will be registered with Temporal
      const wrappedSignal = defineSignal<[SignalValueT]>(uniqueSignalName);
      workflow.setHandler(wrappedSignal, async (signalValue: SignalValueT) => {
        // Create a signal object to pass to the handler
        const signal = new Signal(
          signalName,
          signalValue,
          workflow.workflowInfo().workflowId
        );
        return await func(signal);
      });

      // Register the handler under the original signal name
      if (!this._handlers[signalName]) {
        this._handlers[signalName] = [];
      }
      this._handlers[signalName].push([uniqueSignalName, wrappedSignal]);

      return func;
    };
  }

  async signal(signal: Signal<any>): Promise<void> {
    this.validateSignal(signal);

    const workflowHandle = workflow.getExternalWorkflowHandle(signal.workflowId);

    // Send the signal to all registrations of this signal
    await this._lock.runExclusive(async () => {
      const signalTasks: Promise<void>[] = [];

      if (this._pendingSignals[signal.name]) {
        for (const pendingSignal of this._pendingSignals[signal.name]) {
          const registration = pendingSignal;
          if (registration.workflowId === signal.workflowId) {
            // Only signal for registrations of that workflow
            signalTasks.push(
              workflowHandle.signal(registration.uniqueName, signal.payload)
            );
          }
        }
      }

      // Notify any registered handler functions
      if (this._handlers[signal.name]) {
        for (const [uniqueName, _] of this._handlers[signal.name]) {
          signalTasks.push(
            workflowHandle.signal(uniqueName, signal.payload)
          );
        }
      }

      await Promise.all(signalTasks);
    });
  }

  validateSignal(signal: Signal<any>): void {
    super.validateSignal(signal);
    // Add TemporalSignalHandler-specific validation
    if (!signal.workflowId) {
      throw new Error('No workflow_id provided on Signal. That is required for Temporal signals');
    }
  }
}

export interface TemporalExecutorConfig extends ExecutorConfig, TemporalSettings {
  /** Configuration for Temporal executors. */
  modelConfig?: ConfigDict;
}

export class TemporalExecutor extends Executor {
  /** Executor that runs @workflows as Temporal workflows, with @workflow_tasks as Temporal activities */
  config: TemporalExecutorConfig;
  client?: TemporalClient;
  private _worker?: Worker;
  private _activitySemaphore?: { acquire(): Promise<void>; release(): void };

  constructor(
    config?: TemporalExecutorConfig,
    signalBus?: SignalHandler,
    client?: TemporalClient,
    context?: Context,
    ...args: any[]
  ) {
    signalBus = signalBus || new TemporalSignalHandler();
    super({
      engine: 'temporal',
      config,
      signalBus,
      context,
      ...args
    });
    this.config = config || (this.context.config.temporal as TemporalExecutorConfig) || {};
    this.client = client;

    if (this.config.maxConcurrentActivities !== undefined) {
      let permits = this.config.maxConcurrentActivities;
      const waiters: Array<() => void> = [];
      
      this._activitySemaphore = {
        async acquire() {
          if (permits > 0) {
            permits--;
            return;
          }
          
          // Wait for a permit to become available
          await new Promise<void>(resolve => {
            waiters.push(resolve);
          });
          
          permits--;
        },
        release() {
          permits++;
          if (waiters.length > 0 && permits > 0) {
            const resolve = waiters.shift();
            resolve?.();
          }
        }
      };
    }
  }

  /**
   * Convert a function into a Temporal activity and return its info.
   */
  static wrapAsActivity<T>(
    activityName: string,
    func: ((...args: any[]) => T | Promise<T>) | Promise<T>,
    options?: ActivityOptions
  ): (...args: any[]) => Promise<T> {
    // @activity.defn(name=activityName)
    async function wrappedActivity(...args: any[]): Promise<T> {
      try {
        if (typeof func === 'function') {
          const result = func(...args);
          if (result instanceof Promise) {
            return await result;
          }
          return result;
        } else if (func instanceof Promise) {
          return await func;
        } else {
          throw new Error('Function must be a callable or a coroutine');
        }
      } catch (e) {
        // Handle exceptions gracefully
        throw e;
      }
    }

    return wrappedActivity;
  }

  async _executeTaskAsAsync<T>(
    task: ((...args: any[]) => T | Promise<T>) | Promise<T>,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T | Error> {
    async function runTask(
      task: ((...args: any[]) => T | Promise<T>) | Promise<T>
    ): Promise<T | Error> {
      try {
        if (task instanceof Promise) {
          return await task;
        } else if (typeof task === 'function') {
          // Execute the callable with combined args and kwargs
          const result = task(...args, kwargs);
          
          // Handle case where the function returns a promise
          if (result instanceof Promise) {
            return await result;
          }
          
          return result;
        } else {
          throw new Error('Task must be a callable or a promise');
        }
      } catch (e) {
        return e as Error;
      }
    }

    if (this._activitySemaphore) {
      await this._activitySemaphore.acquire();
      try {
        return await runTask(task);
      } finally {
        this._activitySemaphore.release();
      }
    } else {
      return await runTask(task);
    }
  }

  async _executeTask<T>(
    task: ((...args: any[]) => T | Promise<T>) | Promise<T>,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T | Error> {
    const func = typeof task === 'function' ? task : () => task;
    const isWorkflowTask = (func as any).isWorkflowTask === true;
    
    if (!isWorkflowTask) {
      return await this._executeTaskAsAsync(task, args, kwargs);
    }

    const executionMetadata: Record<string, any> = (func as any).executionMetadata || {};

    // Derive stable activity name, e.g. module + qualname
    let activityName = executionMetadata.activityName;
    if (!activityName) {
      activityName = func.name;
    }

    const scheduleToClose = executionMetadata.scheduleToCloseTimeout || this.config.timeoutSeconds;
    const retryPolicy: RetryPolicy | undefined = executionMetadata.retryPolicy;

    const taskActivity = TemporalExecutor.wrapAsActivity(activityName, task);

    try {
      // In Temporal TypeScript, we'd use proxyActivities
      // This is a simplified version
      const activities = proxyActivities({
        startToCloseTimeout: scheduleToClose ? `${scheduleToClose}s` : '120s',
        retry: retryPolicy
      });
      const result = await activities[activityName](...args, kwargs);
      return result;
    } catch (e) {
      // Properly propagate activity errors
      if (e instanceof workflow.ActivityFailure) {
        throw e.cause || e;
      }
      throw e;
    }
  }

  async execute<T>(
    ...tasks: ((...args: any[]) => T | Promise<T>) | Promise<T>[]
  ): Promise<(T | Error)[]> {
    // Must be called from within a workflow
    if (!workflow.isReplaying()) {
      throw new Error('TemporalExecutor.execute must be called from within a workflow');
    }

    // Execute tasks with context
    return await this.executionContext(async () => {
      return await Promise.all(
        tasks.map(task => this._executeTask(task))
      );
    });
  }

  async *executeStreaming<T>(
    ...tasks: ((...args: any[]) => T | Promise<T>) | Promise<T>[]
  ): AsyncGenerator<T | Error> {
    if (!workflow.isReplaying()) {
      throw new Error('TemporalExecutor.execute_streaming must be called from within a workflow');
    }

    await this.executionContext(async () => {
      // Create futures for all tasks
      const futures = tasks.map(task => this._executeTask(task));
      let pending = new Set(futures);

      while (pending.size > 0) {
        // Wait for the first completed task
        const result = await Promise.race([
          ...Array.from(pending).map(future => future.then(result => ({ future, result })))
        ]);

        // Remove the completed task from pending
        pending.delete(result.future);

        // Yield the result
        yield result.result;
      }
    });
  }

  async ensureClient(): Promise<TemporalClient> {
    /**
     * Ensure we have a connected Temporal client.
     */
    if (!this.client) {
      this.client = new TemporalClient({
        address: this.config.host,
        namespace: this.config.namespace,
        // API key would be handled in connection options
      });
    }

    return this.client;
  }

  async startWorker(): Promise<void> {
    /**
     * Start a worker in this process, auto-registering all tasks
     * from the global registry. Also picks up any classes decorated
     * with @workflow_defn as recognized workflows.
     */
    await this.ensureClient();

    if (!this._worker) {
      // We'll collect the activities from the global registry
      const activityRegistry = this.context.taskRegistry;
      const activities: any[] = [];
      
      for (const name of activityRegistry.listActivities()) {
        activities.push(activityRegistry.getActivity(name));
      }

      this._worker = new Worker({
        connection: this.client.connection,
        taskQueue: this.config.taskQueue || 'default',
        workflowsPath: require.resolve('./workflows'), // Path to workflow implementations
        activities: activities,
      });
      
      console.log(
        `Starting Temporal Worker on task queue '${this.config.taskQueue}' with ${activities.length} activities.`
      );
    }

    await this._worker.run();
  }
}
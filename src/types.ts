/**
 * Core types for the MCP Agent framework
 */
import { z } from "zod";

/**
 * Common types used throughout the application
 */

/**
 * Human input request and response types
 */
export const HumanInputRequestSchema = z.object({
  prompt: z.string().describe("The prompt to show to the human"),
  description: z
    .string()
    .optional()
    .describe("Optional description of what the input is for"),
  timeout_seconds: z
    .number()
    .optional()
    .default(300)
    .describe("Timeout in seconds"),
  request_id: z.string().optional().describe("Unique ID for this request"),
  workflow_id: z
    .string()
    .optional()
    .describe("ID of the workflow making the request"),
});

export type HumanInputRequest = z.infer<typeof HumanInputRequestSchema>;

export const HumanInputResponseSchema = z.object({
  text: z.string().describe("The text input from the human"),
  metadata: z
    .record(z.any())
    .optional()
    .describe("Optional metadata about the response"),
});

export type HumanInputResponse = z.infer<typeof HumanInputResponseSchema>;

/**
 * Options for the human input handler
 */
export interface HumanInputOptions {
  timeout?: number; // Timeout in milliseconds
  description?: string; // Description of the input request
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Human input callback function type
 */
export type HumanInputCallback = (
  prompt: string,
  options?: HumanInputOptions
) => Promise<string>;

/**
 * Server configuration type
 * @deprecated Use ServerConfig from config.ts instead
 */
export interface ServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
  cwd?: string;
}

/**
 * Function type for a task/action in a workflow
 */
export type TaskFunction<T = any, Args extends any[] = any[]> = (
  ...args: Args
) => Promise<T>;

/**
 * Retry policy for workflow tasks
 */
export interface RetryPolicy {
  maximumAttempts?: number;
  initialInterval?: number;
  maximumInterval?: number;
  backoffCoefficient?: number;
  nonRetryableErrorTypes?: string[];
}

/**
 * Options for workflow tasks
 */
export interface WorkflowTaskOptions {
  name?: string;
  scheduleToCloseTimeout?: number;
  retryPolicy?: RetryPolicy;
  [key: string]: any;
}

/**
 * Options for workflows
 */
export interface WorkflowOptions {
  workflowId?: string;
  [key: string]: any;
}

/**
 * Log levels (move these to logger.ts)
 * @deprecated Use LogLevel from logging/logger.ts instead
 */
export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * Execution engine types
 */
export enum ExecutionEngine {
  ASYNCIO = "asyncio",
  TEMPORAL = "temporal",
}

/**
 * Signal types
 */
export type SignalWaitCallback = (
  signalName: string,
  requestId: string,
  workflowId: string,
  signalDescription?: string
) => Promise<void>;

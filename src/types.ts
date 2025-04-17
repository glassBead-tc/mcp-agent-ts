/**
 * Core types for the MCP Agent framework
 */
import { z } from 'zod';

/**
 * Human input request and response types
 */
export const HumanInputRequestSchema = z.object({
  prompt: z.string().describe("The prompt to show to the human"),
  description: z.string().optional().describe("Optional description of what the input is for"),
  timeout_seconds: z.number().optional().default(300).describe("Timeout in seconds"),
  request_id: z.string().optional().describe("Unique ID for this request"),
  workflow_id: z.string().optional().describe("ID of the workflow making the request"),
});

export type HumanInputRequest = z.infer<typeof HumanInputRequestSchema>;

export const HumanInputResponseSchema = z.object({
  text: z.string().describe("The text input from the human"),
  metadata: z.record(z.any()).optional().describe("Optional metadata about the response"),
});

export type HumanInputResponse = z.infer<typeof HumanInputResponseSchema>;

export type HumanInputCallback = (request: HumanInputRequest) => Promise<HumanInputResponse>;

export const HUMAN_INPUT_SIGNAL_NAME = "__human_input__";
export const HUMAN_INPUT_TOOL_NAME = "__human_input__";

/**
 * Logging levels
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical"
}

/**
 * Execution engine types
 */
export enum ExecutionEngine {
  ASYNCIO = "asyncio",
  TEMPORAL = "temporal"
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

/**
 * Workflow signal system for MCP Agent
 */
import { getLogger } from '../logging/logger';

const logger = getLogger('workflow_signal');

/**
 * Signal wait callback type
 */
export type SignalWaitCallback = (
  signalName: string,
  requestId: string,
  workflowId: string,
  signalDescription?: string
) => Promise<void>;

/**
 * Console signal notification callback
 */
export async function consoleSignalNotification(
  signalName: string,
  requestId: string,
  workflowId: string,
  signalDescription?: string
): Promise<void> {
  console.log(`Waiting for signal: ${signalName}`);
  if (signalDescription) {
    console.log(`Description: ${signalDescription}`);
  }
  console.log(`Request ID: ${requestId}`);
  console.log(`Workflow ID: ${workflowId}`);
}

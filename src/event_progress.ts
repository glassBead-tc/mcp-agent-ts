/**
 * Module for converting log events to progress events
 */

import { Event } from './logging/events';

/**
 * Progress actions available in the system
 */
export enum ProgressAction {
  STARTING = "Starting",
  LOADED = "Loaded",
  RUNNING = "Running",
  INITIALIZED = "Initialized",
  CHATTING = "Chatting",
  ROUTING = "Routing",
  PLANNING = "Planning",
  READY = "Ready",
  CALLING_TOOL = "Calling Tool",
  FINISHED = "Finished",
  SHUTDOWN = "Shutdown",
  AGGREGATOR_INITIALIZED = "Running",
  FATAL_ERROR = "Error"
}

/**
 * Represents a progress event converted from a log event
 */
export class ProgressEvent {
  action: ProgressAction;
  target: string;
  details?: string;
  agent_name?: string;
  
  /**
   * Create a new progress event
   * 
   * @param action - The action being performed
   * @param target - The target of the action
   * @param details - Optional details about the action
   * @param agent_name - Optional name of the agent
   */
  constructor(
    action: ProgressAction,
    target: string,
    details?: string,
    agent_name?: string
  ) {
    this.action = action;
    this.target = target;
    this.details = details;
    this.agent_name = agent_name;
  }
  
  /**
   * Format the progress event for display
   */
  toString(): string {
    // Adjust action to be 11 chars wide with padding
    const paddedAction = this.action.padEnd(11, ' ');
    let base = `${paddedAction}. ${this.target}`;
    
    if (this.details) {
      base += ` - ${this.details}`;
    }
    
    if (this.agent_name) {
      base = `[${this.agent_name}] ${base}`;
    }
    
    return base;
  }
}

/**
 * Convert a log event to a progress event if applicable
 * 
 * @param event - The log event to convert
 * @returns The progress event, or undefined if not applicable
 */
export function convertLogEvent(event: Event): ProgressEvent | undefined {
  // Check to see if there is any additional data
  if (!event.data) {
    return undefined;
  }
  
  const eventData = event.data.data;
  if (!eventData || typeof eventData !== 'object') {
    return undefined;
  }
  
  const progressAction = eventData.progress_action;
  if (!progressAction) {
    return undefined;
  }
  
  // Build target string based on the event type
  // Progress display is currently [time] [event] --- [target] [details]
  const namespace = event.namespace;
  const agentName = eventData.agent_name;
  let target = agentName !== undefined ? agentName : "unknown";
  let details = "";
  
  if (progressAction === ProgressAction.FATAL_ERROR) {
    details = eventData.error_message || "An error occurred";
  } else if (namespace.includes("mcp_aggregator")) {
    const serverName = eventData.server_name || "";
    const toolName = eventData.tool_name;
    
    if (toolName) {
      details = `${serverName} (${toolName})`;
    } else {
      details = `${serverName}`;
    }
  } else if (namespace.includes("augmented_llm")) {
    const model = eventData.model || "";
    
    details = `${model}`;
    // Add chat turn if present
    const chatTurn = eventData.chat_turn;
    if (chatTurn !== undefined) {
      details = `${model} turn ${chatTurn}`;
    }
  } else if (namespace.includes("router_llm")) {
    details = "Requesting routing from LLM";
  } else {
    const explicitTarget = eventData.target;
    if (explicitTarget !== undefined) {
      target = explicitTarget;
    }
  }
  
  return new ProgressEvent(
    progressAction as ProgressAction,
    target,
    details || undefined,
    agentName
  );
}
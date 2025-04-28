/**
 * MCP Agent TypeScript - Main entry point
 */

// Export core components
export { MCPApp } from "./app";
export { Agent } from "./agents/agent";
export {
  Context,
  initializeContext,
  cleanupContext,
  getCurrentContext,
} from "./context";
export { getSettings, updateSettings } from "./config";
export { getLogger } from "./logging/logger";
export { ContextDependent } from "./context_dependent";

// Export core exceptions and decorator app
export * from "./core";

// Export telemetry
export * from "./telemetry";

// Export console utilities
export * from "./console";

// Export event progress
export * from "./event_progress";

// Export types
export * from "./types";

// Export executor components
export { Executor } from "./executor/executor";
export { ActivityRegistry } from "./executor/task_registry";
export { DecoratorRegistry } from "./executor/decorator_registry";
export { BaseWorkflow } from "./executor/workflow";

// Export MCP components
export { MCPConnectionManager } from "./mcp/mcp_connection_manager";
export { MCPAggregator } from "./mcp/mcp_aggregator";
export { ServerRegistry } from "./mcp/server_registry";

// Export workflow components
export * from "./workflows";

// Export human input components
export { consoleInputCallback } from "./human_input/handler";

// Export CLI
export { runCLI } from "./cli/main";
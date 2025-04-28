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
export * from "./executor";

// Export MCP components
export { MCPConnectionManager } from "./mcp/mcp_connection_manager";
export { MCPAggregator } from "./mcp/mcp_aggregator";
export { ServerRegistry } from "./mcp/server_registry";
export { genClient, connect, disconnect } from "./mcp/gen_client";
export { MCPAgentClientSession } from "./mcp/mcp_agent_client_session";
export { websocketClient } from "./mcp/websocket";
export { stdioClientWithRichStderr } from "./mcp/stdio";
export { app as mcpAgentServer, run as runMcpAgentServer, provideUserInput } from "./mcp/mcp_agent_server";
export { ServerRegistry as MCPServerRegistry, InitHookCallable } from "./mcp_server_registry";

// Export workflow components
export * from "./workflows";

// Export human input components
export { consoleInputCallback } from "./human_input/handler";
export * from "./human_input/types";

// Export logging components
export { telemetry, MCPRequestTrace } from "./logging/tracing";
export { RichProgressDisplay } from "./logging/rich_progress";

// Export progress display
export { ProgressDisplay } from "./progress_display";

// Export evaluation module
export * from "./eval";

// Export CLI
export { runCLI, createProgram } from "./cli/main";
export { Application } from "./cli/terminal";
export { configCommand } from "./cli/commands/config";
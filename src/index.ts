/**
 * MCP Agent TypeScript - Main entry point
 */

// Export core components
export { MCPApp } from "./app.js";
export { Agent } from "./agents/agent.js";
export {
  Context,
  initializeContext,
  cleanupContext,
  getCurrentContext,
} from "./context.js";
export { getSettings, updateSettings } from "./config.js";
export { getLogger } from "./logging/logger.js";
export { ContextDependent } from "./context_dependent.js";

// Export core exceptions and decorator app
export * from "./core.js";

// Export telemetry
export * from "./telemetry.js";

// Export console utilities
export * from "./console.js";

// Export event progress
export * from "./event_progress.js";

// Export types
export * from "./types.js";

// Export executor components
export * from "./executor.js";

// Export MCP components
export { MCPConnectionManager } from "./mcp/mcp_connection_manager.js";
export { MCPAggregator } from "./mcp/mcp_aggregator.js";
export { ServerRegistry } from "./mcp/server_registry.js";
export { genClient, connect, disconnect } from "./mcp/gen_client.js";
export { MCPAgentClientSession } from "./mcp/mcp_agent_client_session.js";
export { websocketClient } from "./mcp/websocket.js";
export { stdioClientWithRichStderr } from "./mcp/stdio.js";
export { app as mcpAgentServer, run as runMcpAgentServer, provideUserInput } from "./mcp/mcp_agent_server.js";
export { ServerRegistry as MCPServerRegistry, InitHookCallable } from "./mcp_server_registry.js";

// Export workflow components
export * from "./workflows.js";

// Export human input components
export { consoleInputCallback } from "./human_input/handler.js";
export * from "./human_input/types.js";

// Export logging components
export { telemetry, MCPRequestTrace } from "./logging/tracing.js";
export { RichProgressDisplay } from "./logging/rich_progress.js";

// Export progress display
export { ProgressDisplay } from "./progress_display.js";

// Export evaluation module
export * from "./eval.js";

// Export CLI
export { runCLI, createProgram } from "./cli/main.js";
export { Application } from "./cli/terminal.js";
export { configCommand } from "./cli/commands/config.js";
/**
 * MCP Agent Server implementation
 */

import { FastMCP, NotificationOptions } from 'mcp/server/fastmcp';
import { stdioServer } from 'mcp/server/stdio';
import { getTemporalClient } from '../executor/temporal';
import { setupTracing } from '../logging/tracing';

// Create the MCP Agent server
const app = new FastMCP('mcp-agent-server');

// Setup tracing
setupTracing('mcp-agent-server');

/**
 * Run the MCP agent server on stdio
 */
export async function run(): Promise<void> {
  const [readStream, writeStream] = await stdioServer();
  
  await app.mcpServer.run(
    readStream,
    writeStream,
    app.mcpServer.createInitializationOptions({
      notificationOptions: {
        toolsChanged: true,
        resourcesChanged: true
      } as NotificationOptions
    })
  );
}

/**
 * Run a workflow by name or ID
 */
app.tool('run_workflow', async (query: string) => {
  // Implementation would run a specific workflow
  // This is a placeholder for actual implementation
  return `Running workflow: ${query}`;
});

/**
 * Pause a running workflow
 */
app.tool('pause_workflow', async (workflowId: string) => {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.getWorkflowHandle(workflowId);
  await handle.signal('pause');
  return `Paused workflow: ${workflowId}`;
});

/**
 * Resume a paused workflow
 */
app.tool('resume_workflow', async (workflowId: string) => {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.getWorkflowHandle(workflowId);
  await handle.signal('resume');
  return `Resumed workflow: ${workflowId}`;
});

/**
 * Provide user/human input to a waiting workflow step
 */
export async function provideUserInput(workflowId: string, inputData: string): Promise<void> {
  const temporalClient = await getTemporalClient();
  const handle = temporalClient.getWorkflowHandle(workflowId);
  await handle.signal('human_input', inputData);
}

// Export the app for external use
export { app };

// Main entry point when run directly
if (require.main === module) {
  run().catch(err => {
    console.error('Error running MCP Agent server:', err);
    process.exit(1);
  });
}
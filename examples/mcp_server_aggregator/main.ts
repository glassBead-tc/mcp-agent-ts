import path from 'path';
import { MCPApp } from '../../src/app';
import { getLogger } from '../../src/logging/logger';
import { MCPAggregator } from '../../src/mcp/mcp_aggregator';

const app = new MCPApp({ name: "mcp_server_aggregator" });

// Example with persistent connections
async function exampleUsagePersistent() {
  const context = app.context;
  const logger = getLogger("mcp_server_aggregator.example_usage_persistent");
  
  logger.info("Hello, world! Let's create an MCP aggregator (server-of-servers)...");
  logger.info("Current config:", { data: context.config });

  // Add the current directory to the filesystem server's args
  if (context.config.mcp?.servers?.filesystem?.args) {
    context.config.mcp.servers.filesystem.args.push(process.cwd());
  }

  // Create an MCP aggregator that connects to the fetch and filesystem servers
  let aggregator: MCPAggregator | null = null;

  try {
    // Create a new aggregator with persistent connections
    aggregator = new MCPAggregator(
      context,
      ["fetch", "filesystem"],
      true // connection_persistence=true
    );
    
    await aggregator.initialize();
    
    // Call list_tools on the aggregator, which will search all servers for the tool
    logger.info("Aggregator: Calling list_tools...");
    const result = await aggregator.listTools();
    logger.info("Tools available:", { data: result });

    // Call read_file on the aggregator, which will search all servers for the tool
    const readFileResult = await aggregator.callTool(
      "filesystem:read_file",
      { path: path.join(process.cwd(), "README.md") }
    );
    logger.info("read_file result:", { data: readFileResult });

    // Call fetch.fetch on the aggregator
    // (i.e. server-namespacing -- fetch is the servername, which exposes fetch tool)
    const fetchResult = await aggregator.callTool(
      "fetch:fetch",
      { url: "https://jsonplaceholder.typicode.com/todos/1" }
    );
    logger.info("fetch result:", { data: fetchResult });
  } catch (error) {
    logger.error("Error in example_usage_persistent:", { error });
  } finally {
    logger.info("Closing all server connections on aggregator...");
    if (aggregator) {
      await aggregator.close();
    }
  }
}

// Example with non-persistent connections
async function exampleUsage() {
  const context = app.context;
  const logger = getLogger("mcp_server_aggregator.example_usage");
  
  logger.info("Hello, world! Let's create an MCP aggregator (server-of-servers)...");
  logger.info("Current config:", { data: context.config });

  // Add the current directory to the filesystem server's args
  if (context.config.mcp?.servers?.filesystem?.args) {
    context.config.mcp.servers.filesystem.args.push(process.cwd());
  }

  // Create an MCP aggregator that connects to the fetch and filesystem servers
  let aggregator: MCPAggregator | null = null;

  try {
    // Create a new aggregator without persistent connections
    aggregator = new MCPAggregator(
      context,
      ["fetch", "filesystem"],
      false // connection_persistence=false
    );
    
    await aggregator.initialize();
    
    // Call list_tools on the aggregator, which will search all servers for the tool
    logger.info("Aggregator: Calling list_tools...");
    const result = await aggregator.listTools();
    logger.info("Tools available:", { data: result });

    // Call read_file on the aggregator, which will search all servers for the tool
    const readFileResult = await aggregator.callTool(
      "filesystem:read_file",
      { path: path.join(process.cwd(), "README.md") }
    );
    logger.info("read_file result:", { data: readFileResult });

    // Call fetch.fetch on the aggregator
    // (i.e. server-namespacing -- fetch is the servername, which exposes fetch tool)
    const fetchResult = await aggregator.callTool(
      "fetch:fetch",
      { url: "https://jsonplaceholder.typicode.com/todos/1" }
    );
    logger.info("fetch result:", { data: fetchResult });
  } catch (error) {
    logger.error("Error in example_usage:", { error });
  } finally {
    logger.info("Closing all server connections on aggregator...");
    if (aggregator) {
      await aggregator.close();
    }
  }
}

// Main function
async function main() {
  try {
    await app.initialize();
    
    console.time("Persistent connection");
    await exampleUsagePersistent();
    console.timeEnd("Persistent connection");
    
    console.time("Non-persistent connection");
    await exampleUsage();
    console.timeEnd("Non-persistent connection");
  } finally {
    await app.shutdown();
  }
}

// Run the example
main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
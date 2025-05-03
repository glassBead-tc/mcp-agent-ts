import { MCPApp } from "../../src/app";
import { MCPConnectionManager } from "../../src/mcp/mcp_connection_manager";

const app = new MCPApp({ name: "mcp_hello_world" });

async function exampleUsage() {
  await app.initialize();
  try {
    const context = app.context;
    const logger = context.logger;

    logger.info("Hello, world!");
    logger.info("Current config:", { data: context.config });

    // Use a connection manager for temporary connections
    const tempConnectionManager = new MCPConnectionManager(context);
    await tempConnectionManager.initialize();

    try {
      // Get a fetch client
      const fetchClient = await tempConnectionManager.getClient("fetch");
      if (!fetchClient) {
        logger.error("Failed to connect to fetch server");
        return;
      }

      logger.info("fetch: Connected to server, calling list_tools...");
      const result = await fetchClient.listTools();
      logger.info("Tools available:", { data: result });
    } finally {
      await tempConnectionManager.close();
    }

    // Connect to servers using a persistent connection manager
    const connectionManager = new MCPConnectionManager(context);
    await connectionManager.initialize();

    try {
      const filesystemClient = await connectionManager.getClient("filesystem");
      if (filesystemClient) {
        logger.info(
          "filesystem: Connected to server with persistent connection."
        );

        const filesystemTools = await filesystemClient.listTools();
        logger.info("filesystem: Tools available:", { data: filesystemTools });
      }

      const fetchClientPersistent = await connectionManager.getClient("fetch");
      if (fetchClientPersistent) {
        logger.info("fetch: Connected to server with persistent connection.");

        const fetchTools = await fetchClientPersistent.listTools();
        logger.info("fetch: Tools available:", { data: fetchTools });
      }
    } finally {
      await connectionManager.close();
    }
  } finally {
    await app.cleanup();
  }
}

// Run the example
exampleUsage().catch((err) => {
  console.error("Error in example:", err);
  process.exit(1);
});

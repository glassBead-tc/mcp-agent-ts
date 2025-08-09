import { MCPApp, genClient, MCPConnectionManager } from '../../src';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_hello_world' });
  await app.run(async (instance) => {
    const { logger, context } = instance;

    logger.info('Hello, world!');
    logger.info('Current config:', { data: context.config });

    const fetchClient = await genClient('fetch', context.serverRegistry);
    logger.info('fetch: Connected to server, calling list_tools...');
    const tools = await fetchClient.listTools();
    logger.info('Tools available:', { data: tools });

    const connectionManager = new MCPConnectionManager(context);
    await connectionManager.initialize();

    const filesystemClient = await connectionManager.getClient('filesystem');
    logger.info('filesystem: Connected to server with persistent connection.');

    const fetchClient2 = await connectionManager.getClient('fetch');
    logger.info('fetch: Connected to server with persistent connection.');

    if (filesystemClient) {
      const fsTools = await filesystemClient.listTools();
      logger.info('filesystem: Tools available:', { data: fsTools });
    }

    if (fetchClient2) {
      const fetchTools = await fetchClient2.listTools();
      logger.info('fetch: Tools available:', { data: fetchTools });
    }

    await connectionManager.close();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

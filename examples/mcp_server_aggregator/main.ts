import { MCPApp } from '../../src';
import { MCPAggregator } from '../../src/mcp/mcp_aggregator.js';

async function exampleUsagePersistent(app: MCPApp) {
  const context = app.context;
  const logger = app.logger;

  logger.info("Hello, world! Let's create an MCP aggregator (server-of-servers)...");
  logger.info('Current config:', { data: context.config });

  const aggregator = await MCPAggregator.create({
    serverNames: ['fetch', 'filesystem'],
    connectionPersistence: true,
  });

  logger.info('Aggregator: Calling list_tools...');
  const tools = await aggregator.listTools();
  logger.info('Tools available:', { data: tools });

  const result = await aggregator.callTool({ name: 'read_file', arguments: { path: `${process.cwd()}/README.md` } });
  logger.info('read_file result:', { data: result });

  const fetchResult = await aggregator.callTool({ name: 'fetch_fetch', arguments: { url: 'https://jsonplaceholder.typicode.com/todos/1' } });
  logger.info('fetch result:', { data: fetchResult });

  logger.info('Closing all server connections on aggregator...');
  await aggregator.close();
}

async function exampleUsage(app: MCPApp) {
  const context = app.context;
  const logger = app.logger;

  logger.info("Hello, world! Let's create an MCP aggregator (server-of-servers)...");
  logger.info('Current config:', { data: context.config });

  const aggregator = await MCPAggregator.create({
    serverNames: ['fetch', 'filesystem'],
    connectionPersistence: false,
  });

  logger.info('Aggregator: Calling list_tools...');
  const tools = await aggregator.listTools();
  logger.info('Tools available:', { data: tools });

  const result = await aggregator.callTool({ name: 'read_file', arguments: { path: `${process.cwd()}/README.md` } });
  logger.info('read_file result:', { data: result });

  const fetchResult = await aggregator.callTool({ name: 'fetch_fetch', arguments: { url: 'https://jsonplaceholder.typicode.com/todos/1' } });
  logger.info('fetch result:', { data: fetchResult });

  logger.info('Closing all server connections on aggregator...');
  await aggregator.close();
}

async function main() {
  const app = new MCPApp({ name: 'mcp_server_aggregator' });
  await app.initialize();
  try {
    await exampleUsagePersistent(app);
    await exampleUsage(app);
  } finally {
    await app.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

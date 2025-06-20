import { MCPApp, Agent } from '../../src';

async function testSSE(): Promise<void> {
  const app = new MCPApp({ name: 'test-app' });
  await app.run(async () => {
    console.log('MCP App initialized.');

    const agent = new Agent({
      name: 'agent',
      instruction: 'You are an assistant',
      serverNames: ['mcp_test_server_sse'],
    });

    await agent.initialize();
    const tools = await agent.listTools();
    console.log(tools);
    await agent.shutdown();
  });
}

testSSE().catch((err) => {
  console.error(err);
  process.exit(1);
});

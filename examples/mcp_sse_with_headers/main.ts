import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_sse_with_auth' });
  await app.run(async (instance) => {
    const { logger } = instance;
    logger.info('Current config:', { data: instance.context.config });

    const agent = new Agent({
      name: 'slack-agent',
      instruction: 'You are an agent whose job is to interact with the Slack workspace for the user.',
      serverNames: ['slack'],
      context: instance.context,
    });

    await agent.initialize();
    logger.info('slack-agent: Connected to server, calling list_tools...');
    const result = await agent.listTools();
    logger.info('Tools available:', { data: result });

    const llm = await agent.attachLLM(async (a) => new OpenAIAugmentedLLM({ agent: a }));
    const channels = await llm.generate('List all Slack channels in the workspace');
    logger.info(`Slack channels: ${channels}`);

    await agent.shutdown();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

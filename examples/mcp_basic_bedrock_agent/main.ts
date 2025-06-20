import { MCPApp, Agent } from '../../src';
import { BedrockAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_basic_agent' });
  await app.run(async (instance) => {
    const { logger, context } = instance;
    logger.info('Current config:', { data: context.config });

    const finder = new Agent({
      name: 'finder',
      instruction: `You are an agent with the ability to fetch URLs. Your job is to identify the closest match to a user's request, make the appropriate tool calls, and return the URI and CONTENTS of the closest match.`,
      serverNames: ['fetch'],
      context: instance.context,
    });

    await finder.initialize();
    const llm = await finder.attachLLM(async (agent) => new BedrockAugmentedLLM({ agent }));

    const result1 = await llm.generateStr('Print the first 2 paragraphs of https://modelcontextprotocol.io/introduction');
    logger.info(`First 2 paragraphs of Model Context Protocol docs: ${result1}`);

    await finder.shutdown();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM, AnthropicAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_basic_agent' });
  await app.run(async (appInstance) => {
    const logger = appInstance.logger;
    const context = appInstance.context;
    logger.info('Current config:', { data: context.config });

    const fsServer = (context.config as any).mcp.servers?.filesystem;
    if (fsServer && Array.isArray(fsServer.args)) {
      fsServer.args.push(process.cwd());
    }

    const finder = new Agent({
      name: 'finder',
      instruction: `You are an agent with access to the filesystem, as well as the ability to fetch URLs. Your job is to identify the closest match to a user's request, make the appropriate tool calls, and return the URI and CONTENTS of the closest match.`,
      serverNames: ['fetch', 'filesystem'],
      context: appInstance.context,
    });

    await finder.initialize();
    const openAILlm = await finder.attachLLM(async (agent) => new OpenAIAugmentedLLM({ agent }));
    const result1 = await openAILlm.generateStr('Print the contents of mcp_agent.config.yaml verbatim');
    logger.info(`mcp_agent.config.yaml contents: ${result1}`);

    const anthropicLlm = await finder.attachLLM(async (agent) => new AnthropicAugmentedLLM({ agent }));
    const result2 = await anthropicLlm.generateStr('Print the first 2 paragraphs of https://modelcontextprotocol.io/introduction');
    logger.info(`First 2 paragraphs of Model Context Protocol docs: ${result2}`);

    const result3 = await anthropicLlm.generateStr('Summarize those paragraphs in a 128 character tweet');
    logger.info(`Paragraph as a tweet: ${result3}`);

    await finder.shutdown();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

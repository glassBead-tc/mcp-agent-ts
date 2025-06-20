import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_basic_agent' });
  await app.run(async (instance) => {
    const { logger, context } = instance;
    logger.info('Current config:', { data: context.config });

    const fsServer = (context.config as any).mcp?.servers?.filesystem;
    if (fsServer && Array.isArray(fsServer.args)) {
      fsServer.args.push(process.cwd());
    }

    const finder = new Agent({
      name: 'finder',
      instruction: `You are an agent with access to the filesystem, as well as the ability to fetch URLs. Your job is to identify the closest match to a user's request, make the appropriate tool calls, and return the URI and CONTENTS of the closest match.`,
      serverNames: ['fetch', 'filesystem'],
      context: instance.context,
    });

    await finder.initialize();

    let llm = await finder.attachLLM(async (agent) => new OpenAIAugmentedLLM({ agent, model: 'llama3.2:3b' }));
    const result1 = await llm.generateStr('Print the contents of mcp_agent.config.yaml verbatim');
    logger.info(`Result: ${result1}`);

    llm = await finder.attachLLM(async (agent) => new OpenAIAugmentedLLM({ agent, model: 'llama3.1:8b' }));
    const result2 = await llm.generateStr('Print the first 2 paragraphs of https://modelcontextprotocol.io/introduction');
    logger.info(`Result: ${result2}`);

    llm = await finder.attachLLM(async (agent) => new OpenAIAugmentedLLM({ agent, model: 'llama3.2:3b' }));
    const result3 = await llm.generateStr('Summarize those paragraphs in a 128 character tweet');
    logger.info(`Result: ${result3}`);

    await finder.shutdown();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

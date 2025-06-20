import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_basic_agent' });
  await app.run(async (instance) => {
    const { logger, context } = instance;

    const slackAgent = new Agent({
      name: 'slack_finder',
      instruction: `You are an agent with access to the filesystem as well as Slack conversations. Your job is to identify the closest match to a user's request, make the appropriate tool calls, and return the results.`,
      serverNames: ['filesystem', 'slack'],
      context: instance.context,
    });

    const fsServer = (context.config as any).mcp?.servers?.filesystem;
    if (fsServer && Array.isArray(fsServer.args)) {
      fsServer.args.push(process.cwd());
    }

    await slackAgent.initialize();
    logger.info('slack: Connected to server, calling list_tools...');
    const tools = await slackAgent.listTools();
    logger.info('Tools available:', { data: tools });

    const llm = await slackAgent.attachLLM(async (agent) => new OpenAIAugmentedLLM({ agent }));
    const result1 = await llm.generateStr('What was the last message in the general channel?');
    logger.info(`Result: ${result1}`);

    const result2 = await llm.generateStr('Summarize it for me so I can understand it better.');
    logger.info(`Result: ${result2}`);

    await slackAgent.shutdown();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

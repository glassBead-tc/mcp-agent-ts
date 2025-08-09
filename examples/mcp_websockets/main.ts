import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(username: string): Promise<void> {
  const app = new MCPApp({ name: 'mcp_websockets' });
  await app.run(async (appInstance) => {
    const logger = appInstance.logger;
    const context = appInstance.context;
    logger.info('Current config:', { data: context.config });

    const agent = new Agent({
      name: 'github-agent',
      instruction: `You are an agent whose job is to interact with the Github repository for the user.`,
      serverNames: ['smithery-github'],
      context: appInstance.context,
    });

    await agent.initialize();
    logger.info('github-agent: Connected to server, calling list_tools...');
    const tools = await agent.listTools();
    logger.info('Tools available:', { data: tools });

    const llm = await agent.attachLLM(async (a) => new OpenAIAugmentedLLM({ agent: a }));
    const result = await llm.generateStr(`List all public Github repositories created by the user ${username}.`);
    console.log(`Github repositories: ${result}`);
    await agent.shutdown();
  });
}

const username = process.argv[2];
if (!username) {
  console.error('Usage: node main.ts <github-username>');
  process.exit(1);
}

exampleUsage(username).catch((err) => {
  console.error(err);
  process.exit(1);
});

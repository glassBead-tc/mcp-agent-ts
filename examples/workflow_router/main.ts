import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';
import { LLMRouter } from '../../src/workflows/router/router_llm.js';
import { AnthropicLLMRouter } from '../../src/workflows/router/router_llm_anthropic.js';
import fs from 'fs';
import os from 'os';

function printToConsole(message: string): void {
  console.log(message);
}

function printHelloWorld(): void {
  printToConsole('Hello, world!');
}

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'router' });
  await app.run(async (instance) => {
    const { logger, context } = instance;
    logger.info('Current config:', { data: context.config });

    context.config.mcp.servers['filesystem'].args.push(process.cwd());

    const finderAgent = new Agent({
      name: 'finder',
      instruction: `You are an agent with access to the filesystem and fetch servers.`,
      serverNames: ['fetch', 'filesystem'],
      context,
    });

    const writerAgent = new Agent({
      name: 'writer',
      instruction: `You can write to the filesystem based on user input.`,
      serverNames: ['filesystem'],
      context,
    });

    const reasoningAgent = new Agent({
      name: 'writer',
      instruction: `You are a generalist tasked with reasoning over user queries.`,
      context,
    });

    const llm = new OpenAIAugmentedLLM();
    const router = new LLMRouter({ llm, agents: [finderAgent, writerAgent, reasoningAgent], functions: [printToConsole, printHelloWorld] });

    const results = await router.routeToAgent({ request: 'Print the contents of mcp_agent.config.yaml verbatim', topK: 1 });
    logger.info('Router Results:', { data: results });

    const agent = results[0].result;
    await agent.initialize();
    const tools = await agent.listTools();
    logger.info('Tools available:', { data: tools });
    const readRes = await agent.callTool({ name: 'read_file', arguments: { path: `${process.cwd()}/mcp_agent.config.yaml` } });
    logger.info('read_file result:', { data: readRes });
    await agent.shutdown();

    const anthropicRouter = new AnthropicLLMRouter({
      serverNames: ['fetch', 'filesystem'],
      agents: [finderAgent, writerAgent, reasoningAgent],
      functions: [printToConsole, printHelloWorld],
    });

    const funcResults = await anthropicRouter.routeToFunction({ request: 'Print the input to console', topK: 2 });
    logger.info('Router Results:', { data: funcResults });
    const func = funcResults[0].result;
    func('Hello, world!');

    const serverResults = await anthropicRouter.routeToServer({ request: 'Print the first two paragraphs of https://modelcontextprotocol.io/introduction', topK: 1 });
    logger.info('Router Results:', { data: serverResults });

    const combined = await anthropicRouter.route({ request: 'Print the contents of mcp_agent.config.yaml verbatim', topK: 3 });
    logger.info('Router Results:', { data: combined });
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

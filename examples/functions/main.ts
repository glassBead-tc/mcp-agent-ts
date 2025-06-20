import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';

function addNumbers(a: number, b: number): number {
  console.log(`Math expert is adding ${a} and ${b}`);
  return a + b;
}

function multiplyNumbers(a: number, b: number): number {
  console.log(`Math expert is multiplying ${a} and ${b}`);
  return a * b;
}

async function exampleUsage() {
  const app = new MCPApp({ name: 'mcp_agent_using_functions' });
  await app.run(async (appInstance) => {
    const logger = appInstance.logger;
    const context = appInstance.context;
    logger.info('Current config:', { data: context.config });

    const mathAgent = new Agent({
      name: 'math_agent',
      instruction: `You are an expert in mathematics with access to some functions
        to perform correct calculations. Your job is to identify the closest match
        to a user's request, make the appropriate function calls, and return the result.`,
      functions: [addNumbers, multiplyNumbers],
      context: appInstance.context,
    });

    await mathAgent.initialize();
    const llm = await mathAgent.attachLLM(async (agent) => new OpenAIAugmentedLLM({ agent }));
    const result = await llm.generateStr('Add 2 and 3, then multiply the result by 4.');
    logger.info(`Expert math result: ${result}`);
    await mathAgent.shutdown();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

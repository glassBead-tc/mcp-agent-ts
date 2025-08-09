import { MCPApp, Agent, MCPConnectionManager } from '../../src';
import { AnthropicAugmentedLLM } from '../../src/workflows/llm/index.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'Testing MCP Server roots' });
  await app.run(async (instance) => {
    const { context, logger } = instance;
    const manager = new MCPConnectionManager(context.serverRegistry);
    await manager.initialize();

    const interpreterAgent = new Agent({
      name: 'analysis',
      instruction: 'You have access to a python interpreter with pandas, seaborn and matplotlib installed.',
      serverNames: ['root_test', 'interpreter'],
      context,
    });

    await interpreterAgent.initialize();
    const llm = await interpreterAgent.attachLLM(async (a) => new AnthropicAugmentedLLM({ agent: a }));

    await llm.generateStr(
      "There is a file named '01_Data_Processed.csv' in the current directory. Use the Python Interpreter to analyze the file." +
        ' Produce a detailed description of the data, and any patterns it contains.'
    );

    const result = await llm.generateStr(
      'Consider the data, and how to usefully group it for presentation to a Human. Find insights, using the Python Interpreter as needed.\n' +
        'Use MatPlotLib to produce insightful visualisations. Save them as .png files in the current directory.'
    );
    console.log(result);
    logger.info(result);

    await interpreterAgent.shutdown();
    await manager.close();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

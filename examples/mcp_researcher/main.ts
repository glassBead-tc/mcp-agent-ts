import { MCPApp, Agent, MCPConnectionManager } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';
import fs from 'fs';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_root_test' });
  await app.run(async (instance) => {
    const { context } = instance;
    const folderPath = 'agent_folder';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    context.config.mcp.servers['interpreter'].args = [
      'run',
      '-i',
      '--rm',
      '--pull=always',
      '-v',
      `${process.cwd()}/${folderPath}:/mnt/data/`,
      'ghcr.io/evalstate/mcp-py-repl:latest',
    ];

    const manager = new MCPConnectionManager(context.serverRegistry);
    await manager.initialize();

    const interpreterAgent = new Agent({
      name: 'research',
      instruction: `You are a research assistant with access to web search, a Python interpreter, and a filesystem.`,
      serverNames: ['brave', 'interpreter', 'filesystem', 'fetch'],
      context,
    });

    await interpreterAgent.initialize();
    const llm = await interpreterAgent.attachLLM(async (a) => new OpenAIAugmentedLLM({ agent: a }));

    const prompt = `Produce an investment report for the company Eutelsat. Include description, financial position, PESTLE analysis and investment thesis. Save the report as markdown in the filesystem.`;
    const result = await llm.generateStr(prompt);
    console.log(result);

    await interpreterAgent.shutdown();
    await manager.close();
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function linkedinToFilesystem(criteria: string, maxResults: number, outputPath: string) {
  const app = new MCPApp({ name: 'linkedin_to_filesystem' });
  await app.run(async (appInstance) => {
    const agent = new Agent({
      name: 'linkedin_scraper_agent',
      instruction: `Search LinkedIn for candidates matching: ${criteria}. Save up to ${maxResults} results as CSV to ${outputPath}.`,
      serverNames: ['playwright', 'filesystem'],
      context: appInstance.context,
    });

    await agent.initialize();
    const llm = await agent.attachLLM(async (a) => new OpenAIAugmentedLLM({ agent: a }));

    const prompt = `Complete the following workflow:\n\n` +
      `1. Log in to LinkedIn and search for candidates matching: ${criteria}.\n` +
      `2. Collect up to ${maxResults} candidates and output CSV with header.\n` +
      `3. Save the CSV to ${outputPath} using the filesystem server.`;

    const result = await llm.generateStr(prompt);
    console.log('LLM Output:', result);

    if (fs.existsSync(outputPath)) {
      console.log(`File saved successfully: ${outputPath}`);
    } else {
      console.log('File save not confirmed.');
    }

    await agent.shutdown();
  });
}

const argv = yargs(hideBin(process.argv))
  .option('criteria', { type: 'string', demandOption: true })
  .option('max-results', { type: 'number', default: 10 })
  .option('output', { type: 'string', default: 'candidates.csv' })
  .parseSync();

linkedinToFilesystem(argv.criteria, argv['max-results'], argv.output).catch((err) => {
  console.error(err);
  process.exit(1);
});

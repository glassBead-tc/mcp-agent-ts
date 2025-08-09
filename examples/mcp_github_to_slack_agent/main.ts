import { MCPApp, Agent, MCPConnectionManager } from '../../src';
import { AnthropicAugmentedLLM } from '../../src/workflows/llm/index.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function githubToSlack(owner: string, repo: string, channel: string) {
  const app = new MCPApp({ name: 'github_to_slack' });
  await app.run(async (appInstance) => {
    const manager = new MCPConnectionManager(appInstance.context.serverRegistry);
    await manager.initialize();

    const githubToSlackAgent = new Agent({
      name: 'github_to_slack_agent',
      instruction: `You monitor GitHub pull requests and post prioritized summaries to Slack channel ${channel}.`,
      serverNames: ['github', 'slack'],
      context: appInstance.context,
    });

    await githubToSlackAgent.initialize();
    const llm = await githubToSlackAgent.attachLLM(async (agent) => new AnthropicAugmentedLLM({ agent }));

    const prompt = `Complete the following workflow:\n\n` +
      `1. Retrieve the latest pull requests from ${owner}/${repo} using the GitHub server.\n` +
      `2. Prioritize them and format a concise summary.\n` +
      `3. Post the summary to Slack channel ${channel}.`;

    await llm.generateStr(prompt);

    await githubToSlackAgent.shutdown();
    await manager.close();
  });
}

const argv = yargs(hideBin(process.argv))
  .option('owner', { type: 'string', demandOption: true })
  .option('repo', { type: 'string', demandOption: true })
  .option('channel', { type: 'string', demandOption: true })
  .parseSync();

githubToSlack(argv.owner, argv.repo, argv.channel).catch((err) => {
  console.error(err);
  process.exit(1);
});

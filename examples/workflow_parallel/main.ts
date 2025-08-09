import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';
import { ParallelLLM } from '../../src/workflows/parallel/parallel_llm.js';

const SHORT_STORY = `The Battle of Glimmerwood ...`;

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'mcp_parallel_workflow' });
  await app.run(async (instance) => {
    const { logger } = instance;

    const proofreader = new Agent({
      name: 'proofreader',
      instruction: 'Review the short story for grammar, spelling, and punctuation errors.',
      context: instance.context,
    });

    const factChecker = new Agent({
      name: 'fact_checker',
      instruction: 'Verify the factual consistency within the story.',
      context: instance.context,
    });

    const styleEnforcer = new Agent({
      name: 'style_enforcer',
      instruction: 'Analyze the story for adherence to style guidelines.',
      context: instance.context,
    });

    const grader = new Agent({
      name: 'grader',
      instruction: 'Compile the feedback into a structured report.',
      context: instance.context,
    });

    const parallel = new ParallelLLM({
      fanInAgent: grader,
      fanOutAgents: [proofreader, factChecker, styleEnforcer],
      llmFactory: OpenAIAugmentedLLM,
    });

    const result = await parallel.generateStr({ message: `Student short story submission: ${SHORT_STORY}` });
    logger.info(`${result}`);
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

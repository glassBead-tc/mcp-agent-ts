import { MCPApp, Agent } from '../../src';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/index.js';
import { EvaluatorOptimizerLLM, QualityRating } from '../../src/workflows/evaluator_optimizer/evaluator_optimizer.js';

async function exampleUsage(): Promise<void> {
  const app = new MCPApp({ name: 'cover_letter_writer' });
  await app.run(async (instance) => {
    const { context, logger } = instance;
    logger.info('Current config:', { data: context.config });

    const optimizer = new Agent({
      name: 'optimizer',
      instruction: `You are a career coach specializing in cover letter writing.`,
      serverNames: ['fetch'],
      context,
    });

    const evaluator = new Agent({
      name: 'evaluator',
      instruction: `Evaluate the response based on clarity, specificity, relevance and other criteria. Provide feedback.`,
      context,
    });

    const evaluatorOptimizer = new EvaluatorOptimizerLLM({
      optimizer,
      evaluator,
      llmFactory: OpenAIAugmentedLLM,
      minRating: QualityRating.EXCELLENT,
    });

    const jobPosting = 'Software Engineer at LastMile AI...';
    const candidateDetails = 'Alex Johnson, 3 years in machine learning...';
    const companyInformation = 'Look up from the LastMile AI About page: https://lastmileai.dev/about';

    const result = await evaluatorOptimizer.generateStr({
      message: `Write a cover letter for the following job posting: ${jobPosting}\n\nCandidate Details: ${candidateDetails}\n\nCompany information: ${companyInformation}`,
      requestParams: { model: 'gpt-4o' },
    });

    logger.info(`${result}`);
  });
}

exampleUsage().catch((err) => {
  console.error(err);
  process.exit(1);
});

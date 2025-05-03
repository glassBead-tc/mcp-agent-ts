import { MCPApp } from '../../src/app';
import { Agent } from '../../src/agents/agent';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/augmented_llm_openai';
import { EvaluatorOptimizerLLM, QualityRating } from '../../src/workflows/evaluator_optimizer/evaluator_optimizer';

const app = new MCPApp({ name: "cover_letter_writer" });

async function exampleUsage() {
  try {
    await app.initialize();
    
    const context = app.context;
    const logger = app.context.logger;

    logger.info("Current config:", { data: context.config });

    // Create optimizer agent
    const optimizer = new Agent({
      name: "optimizer",
      instruction: `You are a career coach specializing in cover letter writing.
        You are tasked with generating a compelling cover letter given the job posting,
        candidate details, and company information. Tailor the response to the company and job requirements.`,
      serverNames: ["fetch"],
      context
    });

    // Create evaluator agent
    const evaluator = new Agent({
      name: "evaluator",
      instruction: `Evaluate the following response based on the criteria below:
        1. Clarity: Is the language clear, concise, and grammatically correct?
        2. Specificity: Does the response include relevant and concrete details tailored to the job description?
        3. Relevance: Does the response align with the prompt and avoid unnecessary information?
        4. Tone and Style: Is the tone professional and appropriate for the context?
        5. Persuasiveness: Does the response effectively highlight the candidate's value?
        6. Grammar and Mechanics: Are there any spelling or grammatical issues?
        7. Feedback Alignment: Has the response addressed feedback from previous iterations?

        For each criterion:
        - Provide a rating (EXCELLENT, GOOD, FAIR, or POOR).
        - Offer specific feedback or suggestions for improvement.

        Summarize your evaluation as a structured response with:
        - Overall quality rating.
        - Specific feedback and areas for improvement.`,
      context
    });

    // Initialize agents
    await Promise.all([
      optimizer.initialize(),
      evaluator.initialize()
    ]);

    // Create evaluator-optimizer workflow
    const evaluatorOptimizer = new EvaluatorOptimizerLLM({
      optimizer,
      evaluator,
      llmFactory: async (agent: Agent) => {
        return new OpenAIAugmentedLLM({
          agent,
          model: context.config.openai?.default_model || 'gpt-4o',
          apiKey: context.config.openai?.api_key,
          baseUrl: context.config.openai?.base_url
        });
      },
      minRating: QualityRating.EXCELLENT,
      maxIterations: 3
    });

    // Job details
    const jobPosting = 
      "Software Engineer at LastMile AI. Responsibilities include developing AI systems, " +
      "collaborating with cross-functional teams, and enhancing scalability. Skills required: " +
      "Python, distributed systems, and machine learning.";
    
    const candidateDetails = 
      "Alex Johnson, 3 years in machine learning, contributor to open-source AI projects, " +
      "proficient in Python and TensorFlow. Motivated by building scalable AI systems to solve real-world problems.";

    // This should trigger a 'fetch' call to get the company information
    const companyInformation = 
      "Look up from the LastMile AI About page: https://lastmileai.dev/about";

    // Generate cover letter
    const result = await evaluatorOptimizer.runConversation([
      { 
        role: 'user',
        content: `Write a cover letter for the following job posting: ${jobPosting}\n\nCandidate Details: ${candidateDetails}\n\nCompany information: ${companyInformation}`
      }
    ]);

    // Get the final response
    const finalResponse = result[result.length - 1].content;
    logger.info(`Final cover letter:\n${finalResponse}`);

    // If the result contains evaluation information, log it
    if (result[result.length - 1].metadata?.evaluation) {
      const evaluation = result[result.length - 1].metadata.evaluation;
      logger.info(`Evaluation results:`, { data: evaluation });
    }

    // Shutdown agents
    await Promise.all([
      optimizer.shutdown(),
      evaluator.shutdown()
    ]);
  } finally {
    await app.shutdown();
  }
}

// Run the example
const startTime = Date.now();
exampleUsage()
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.log(`Total run time: ${totalTime.toFixed(2)}s`);
  });
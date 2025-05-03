import { MCPApp } from '../../src/app';
import { Agent } from '../../src/agents/agent';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/augmented_llm_openai';
import { ParallelLLM } from '../../src/workflows/parallel/parallel_llm';

// Short story with intentional errors for the grading example
const SHORT_STORY = `
The Battle of Glimmerwood

In the heart of Glimmerwood, a mystical forest knowed for its radiant trees, a small village thrived. 
The villagers, who were live peacefully, shared their home with the forest's magical creatures, 
especially the Glimmerfoxes whose fur shimmer like moonlight.

One fateful evening, the peace was shaterred when the infamous Dark Marauders attack. 
Lead by the cunning Captain Thorn, the bandits aim to steal the precious Glimmerstones which was believed to grant immortality.

Amidst the choas, a young girl named Elara stood her ground, she rallied the villagers and devised a clever plan.
Using the forests natural defenses they lured the marauders into a trap. 
As the bandits aproached the village square, a herd of Glimmerfoxes emerged, blinding them with their dazzling light, 
the villagers seized the opportunity to captured the invaders.

Elara's bravery was celebrated and she was hailed as the "Guardian of Glimmerwood". 
The Glimmerstones were secured in a hidden grove protected by an ancient spell.

However, not all was as it seemed. The Glimmerstones true power was never confirm, 
and whispers of a hidden agenda linger among the villagers.
`;

const app = new MCPApp({ name: "mcp_parallel_workflow" });

async function exampleUsage() {
  try {
    await app.initialize();
    
    const logger = app.context.logger;
    const context = app.context;

    logger.info("Current config:", { data: context.config });

    // Add the current directory to the filesystem server's args
    if (context.config.mcp?.servers?.filesystem?.args) {
      context.config.mcp.servers.filesystem.args.push(process.cwd());
    }

    // Create the three specialized agents for the fan-out process
    const proofreader = new Agent({
      name: "proofreader",
      instruction: `Review the short story for grammar, spelling, and punctuation errors.
        Identify any awkward phrasing or structural issues that could improve clarity. 
        Provide detailed feedback on corrections.`,
      context
    });

    const factChecker = new Agent({
      name: "fact_checker",
      instruction: `Verify the factual consistency within the story. Identify any contradictions,
        logical inconsistencies, or inaccuracies in the plot, character actions, or setting. 
        Highlight potential issues with reasoning or coherence.`,
      context
    });

    const styleEnforcer = new Agent({
      name: "style_enforcer",
      instruction: `Analyze the story for adherence to style guidelines.
        Evaluate the narrative flow, clarity of expression, and tone. Suggest improvements to 
        enhance storytelling, readability, and engagement.`,
      context
    });

    // Create the aggregator agent for the fan-in process
    const grader = new Agent({
      name: "grader",
      instruction: `Compile the feedback from the Proofreader, Fact Checker, and Style Enforcer
        into a structured report. Summarize key issues and categorize them by type. 
        Provide actionable recommendations for improving the story, 
        and give an overall grade based on the feedback.`,
      context
    });

    // Initialize all agents
    await Promise.all([
      proofreader.initialize(),
      factChecker.initialize(),
      styleEnforcer.initialize(),
      grader.initialize()
    ]);

    // Create the parallel LLM to process the story
    const parallel = new ParallelLLM({
      fanInAgent: grader,
      fanOutAgents: [proofreader, factChecker, styleEnforcer],
      llmFactory: async (agent: Agent) => {
        return new OpenAIAugmentedLLM({
          agent,
          model: context.config.openai?.default_model || 'gpt-4o',
          apiKey: context.config.openai?.api_key,
          baseUrl: context.config.openai?.base_url
        });
      }
    });

    // Process the short story in parallel
    const result = await parallel.runConversation([
      {
        role: 'user',
        content: `Student short story submission: ${SHORT_STORY}`
      }
    ]);

    // Get the final response from the grader
    const finalResponse = result[result.length - 1].content;
    logger.info(`${finalResponse}`);

    // Shutdown all agents
    await Promise.all([
      proofreader.shutdown(),
      factChecker.shutdown(),
      styleEnforcer.shutdown(),
      grader.shutdown()
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
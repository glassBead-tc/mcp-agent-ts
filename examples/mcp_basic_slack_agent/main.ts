import { MCPApp } from "../../src/app";
import { Agent } from "../../src/agents/agent";
import { OpenAIAugmentedLLM } from "../../src/workflows/llm/augmented_llm_openai";

const app = new MCPApp({ name: "mcp_basic_agent" });

async function exampleUsage() {
  try {
    await app.initialize();

    const logger = app.context.logger;

    // Create a Slack agent
    const slackAgent = new Agent({
      name: "slack_finder",
      instruction: `You are an agent with access to the filesystem, 
      as well as the ability to look up Slack conversations. Your job is to identify 
      the closest match to a user's request, make the appropriate tool calls, 
      and return the results.`,
      serverNames: ["filesystem", "slack"],
      context: app.context,
    });

    // Initialize the agent
    await slackAgent.initialize();

    try {
      logger.info("slack: Connected to server, calling list_tools...");
      const result = await slackAgent.listTools();
      logger.info("Tools available:", { data: result });

      // Create LLM for the agent
      const llm = await slackAgent.attachLLM(async (agent) => {
        // Use type assertion to avoid TypeScript errors
        const config = app.context.config as any;
        return new OpenAIAugmentedLLM({
          agent,
          model: config.openai?.default_model || "gpt-4o",
          apiKey: config.openai?.api_key,
          baseUrl: config.openai?.base_url,
        });
      });

      // Initial query
      const firstResult = await llm.runConversation([
        {
          role: "user",
          content: "What was the last message in the general channel?",
        },
      ]);

      logger.info(`Result: ${firstResult[firstResult.length - 1].content}`);

      // Follow-up query (multi-turn conversation)
      const secondResult = await llm.runConversation([
        ...firstResult,
        {
          role: "user",
          content: "Summarize it for me so I can understand it better.",
        },
      ]);

      logger.info(`Result: ${secondResult[secondResult.length - 1].content}`);
    } finally {
      // Shutdown the agent
      await slackAgent.shutdown();
    }
  } finally {
    await app.cleanup();
  }
}

// Run the example
const startTime = Date.now();
exampleUsage()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.log(`Total run time: ${totalTime.toFixed(2)}s`);
  });

import path from "path";
import { MCPApp } from "../../src/app";
import { Agent } from "../../src/agents/agent";
import { OpenAIAugmentedLLM } from "../../src/workflows/llm/augmented_llm_openai";
import { AnthropicAugmentedLLM } from "../../src/workflows/llm/augmented_llm_anthropic";

const app = new MCPApp({ name: "mcp_basic_agent" });

async function exampleUsage() {
  const startTime = Date.now();

  try {
    await app.initialize();
    const logger = app.context.logger;
    const context = app.context;

    logger.info("Current config:", { data: context.config });

    // Add the current directory to the filesystem server's args
    if (context.config.mcp_servers?.filesystem?.args) {
      context.config.mcp_servers.filesystem.args.push(process.cwd());
    }

    const finderAgent = new Agent({
      name: "finder",
      instruction: `You are an agent with access to the filesystem, 
      as well as the ability to fetch URLs. Your job is to identify 
      the closest match to a user's request, make the appropriate tool calls, 
      and return the URI and CONTENTS of the closest match.`,
      serverNames: ["fetch", "filesystem"],
      context: context,
    });

    await finderAgent.initialize();

    try {
      logger.info("finder: Connected to server, calling list_tools...");
      const result = await finderAgent.listTools();
      logger.info("Tools available:", { data: result });

      // Create OpenAI LLM
      const openaiLlm = await finderAgent.attachLLM(async (agent) => {
        // Use type assertion to avoid TypeScript errors
        const config = context.config as any;
        return new OpenAIAugmentedLLM({
          agent,
          model: config.openai?.default_model || "gpt-4o",
          apiKey: config.openai?.api_key,
        });
      });

      // Use OpenAI LLM to generate a response
      const openaiResult = await openaiLlm.runConversation([
        {
          role: "user",
          content: "Print the contents of mcp_agent.config.yaml verbatim",
        },
      ]);

      // Get the last message (assistant's response)
      const openaiResponse = openaiResult[openaiResult.length - 1];
      logger.info(`Result: ${openaiResponse.content}`);

      // Switch to Anthropic LLM
      const anthropicLlm = await finderAgent.attachLLM(async (agent) => {
        // Use type assertion to avoid TypeScript errors
        const config = context.config as any;
        return new AnthropicAugmentedLLM({
          agent,
          model: "claude-3-opus-20240229",
          apiKey: config.anthropic?.api_key,
        });
      });

      // Use Anthropic LLM to generate a response
      const anthropicResult = await anthropicLlm.runConversation([
        {
          role: "user",
          content:
            "Print the first 2 paragraphs of https://www.anthropic.com/research/building-effective-agents",
        },
      ]);

      // Get the last message (assistant's response)
      const anthropicResponse = anthropicResult[anthropicResult.length - 1];
      logger.info(`Result: ${anthropicResponse.content}`);

      // Continue the conversation with Anthropic
      const followupResult = await anthropicLlm.runConversation([
        ...anthropicResult,
        {
          role: "user",
          content: "Summarize those paragraphs in a 128 character tweet",
        },
      ]);

      // Get the last message (assistant's response)
      const followupResponse = followupResult[followupResult.length - 1];
      logger.info(`Result: ${followupResponse.content}`);
    } finally {
      await finderAgent.shutdown();
    }
  } finally {
    await app.cleanup();
  }

  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;

  console.log(`Total run time: ${totalTime.toFixed(2)}s`);
}

// Run the example
exampleUsage().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

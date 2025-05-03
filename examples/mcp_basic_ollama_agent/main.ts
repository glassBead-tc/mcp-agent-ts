import path from "path";
import { MCPApp } from "../../src/app";
import { Agent } from "../../src/agents/agent";
import { OpenAIAugmentedLLM } from "../../src/workflows/llm/augmented_llm_openai";

const app = new MCPApp({ name: "mcp_basic_ollama_agent" });

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

      // Create OpenAI LLM (which will use ollama in this case due to base_url config)
      const ollamaLlm = await finderAgent.attachLLM(async (agent) => {
        // Use type assertion to avoid TypeScript errors
        const config = context.config as any;
        return new OpenAIAugmentedLLM({
          agent,
          baseUrl: config.openai?.base_url || "http://localhost:11434/v1",
          apiKey: config.openai?.api_key || "ollama", // ollama doesn't need a real API key
        });
      });

      // Use Ollama with llama3.2:3b model
      const firstResult = await ollamaLlm.runConversation(
        [
          {
            role: "user",
            content: "Print the contents of mcp_agent.config.yaml verbatim",
          },
        ],
        {
          model: "llama3.2:3b",
        }
      );

      // Get the last message (assistant's response)
      const firstResponse = firstResult[firstResult.length - 1];
      logger.info(`Result: ${firstResponse.content}`);

      // Use Ollama with llama3.1:8b model
      const secondResult = await ollamaLlm.runConversation(
        [
          {
            role: "user",
            content:
              "Print the first 2 paragraphs of https://www.anthropic.com/research/building-effective-agents",
          },
        ],
        {
          model: "llama3.1:8b",
        }
      );

      // Get the last message (assistant's response)
      const secondResponse = secondResult[secondResult.length - 1];
      logger.info(`Result: ${secondResponse.content}`);

      // Continue the conversation with llama3.2:3b model
      const followupResult = await ollamaLlm.runConversation(
        [
          ...secondResult,
          {
            role: "user",
            content: "Summarize those paragraphs in a 128 character tweet",
          },
        ],
        {
          model: "llama3.2:3b",
        }
      );

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

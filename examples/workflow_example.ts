/**
 * Workflow example for MCP Agent
 *
 * This example demonstrates how to use the different workflow patterns
 * in MCP Agent.
 */
import {
  MCPApp,
  Agent,
  OpenAIAugmentedLLM,
  AnthropicAugmentedLLM,
  ParallelLLM,
  LLMRouter,
  Orchestrator,
} from "../src";

/**
 * Example function to get current time
 */
async function getCurrentTime(): Promise<string> {
  return new Date().toISOString();
}

/**
 * Example function to get weather
 */
async function getWeather(location: string): Promise<string> {
  return `Weather for ${location}: Sunny, 75°F`;
}

/**
 * Main function
 */
async function main() {
  // Create app
  const app = new MCPApp({
    name: "workflow-example",
  });

  // Run the app
  await app.run(async (app) => {
    console.log("Creating agents...");

    // Create agents for different purposes
    const researchAgent = new Agent({
      name: "researcher",
      instruction: "You are a research agent that finds information.",
      functions: [getCurrentTime, getWeather],
      context: app.context,
    });

    const writerAgent = new Agent({
      name: "writer",
      instruction: "You are a writer agent that creates content.",
      context: app.context,
    });

    const editorAgent = new Agent({
      name: "editor",
      instruction: "You are an editor agent that reviews and improves content.",
      context: app.context,
    });

    const factCheckerAgent = new Agent({
      name: "fact_checker",
      instruction: "You are a fact checker agent that verifies information.",
      functions: [getCurrentTime, getWeather],
      context: app.context,
    });

    const summarizerAgent = new Agent({
      name: "summarizer",
      instruction: "You are a summarizer agent that condenses information.",
      context: app.context,
    });

    // Initialize all agents
    await Promise.all([
      researchAgent.initialize(),
      writerAgent.initialize(),
      editorAgent.initialize(),
      factCheckerAgent.initialize(),
      summarizerAgent.initialize(),
    ]);

    // Create LLM factory function
    const llmFactory = async (agent: Agent) => {
      // Use different LLM providers based on agent name
      if (agent.name === "researcher" || agent.name === "fact_checker") {
        return new OpenAIAugmentedLLM({
          agent,
          model: "gpt-4o",
        });
      } else {
        return new AnthropicAugmentedLLM({
          agent,
          model: "claude-3-opus-20240229",
        });
      }
    };

    // Example 1: Router
    console.log("\n=== Example 1: Router ===");

    const router = new LLMRouter({
      llm: await llmFactory(summarizerAgent),
      agents: [researchAgent, writerAgent, editorAgent, factCheckerAgent],
      functions: [getCurrentTime, getWeather],
    });

    console.log("Routing request...");
    const routingResults = await router.route("What is the current time?", 1);

    console.log(
      `Routing result: ${
        routingResults[0].result.name
      } (score: ${routingResults[0].score.toFixed(2)})`
    );

    // Example 2: Parallel
    console.log("\n=== Example 2: Parallel ===");

    const parallel = new ParallelLLM({
      fanOutAgents: [researchAgent, factCheckerAgent],
      fanInAgent: summarizerAgent,
      llmFactory,
    });

    console.log("Running parallel workflow...");
    const parallelResult = await parallel.complete([
      {
        role: "user",
        content: "What is the weather like in New York and London?",
      },
    ]);

    console.log(
      `Parallel result: ${parallelResult.choices[0].message.content}`
    );

    // Example 3: Orchestrator with Full Planning (default)
    console.log("\n=== Example 3: Orchestrator with Full Planning ===");

    const orchestratorFull = new Orchestrator({
      availableAgents: [
        researchAgent,
        writerAgent,
        editorAgent,
        factCheckerAgent,
        summarizerAgent,
      ],
      llmFactory,
      planType: "full", // Explicitly set to full planning (this is the default)
    });

    console.log("Running orchestrator with full planning...");
    const orchestratorFullResult = await orchestratorFull.complete([
      {
        role: "user",
        content:
          "Write a short blog post about the weather in different cities.",
      },
    ]);

    console.log(
      `Orchestrator (full planning) result: ${orchestratorFullResult.choices[0].message.content.substring(
        0,
        150
      )}...`
    );

    // Example 4: Orchestrator with Iterative Planning
    console.log("\n=== Example 4: Orchestrator with Iterative Planning ===");

    const orchestratorIterative = new Orchestrator({
      availableAgents: [
        researchAgent,
        writerAgent,
        editorAgent,
        factCheckerAgent,
        summarizerAgent,
      ],
      llmFactory,
      planType: "iterative", // Use iterative planning mode
    });

    console.log("Running orchestrator with iterative planning...");
    const orchestratorIterativeResult = await orchestratorIterative.complete([
      {
        role: "user",
        content:
          "Create a travel guide for visiting national parks in the United States.",
      },
    ]);

    console.log(
      `Orchestrator (iterative planning) result: ${orchestratorIterativeResult.choices[0].message.content.substring(
        0,
        150
      )}...`
    );

    // Compare the approaches
    console.log("\n=== Comparing Planning Approaches ===");
    console.log(
      "Full Planning: Generates the entire plan upfront, then executes all steps."
    );
    console.log(
      "Iterative Planning: Generates and executes one step at a time, adapting based on previous results."
    );
    console.log(
      "\nIterative planning is particularly useful for complex tasks where:"
    );
    console.log("- The next steps depend on the results of previous steps");
    console.log("- The full plan cannot be determined upfront");
    console.log(
      "- You need to adapt to unexpected results or errors during execution"
    );

    // Shutdown all agents
    await Promise.all([
      researchAgent.shutdown(),
      writerAgent.shutdown(),
      editorAgent.shutdown(),
      factCheckerAgent.shutdown(),
      summarizerAgent.shutdown(),
    ]);
  });
}

// Run the example
main().catch(console.error);

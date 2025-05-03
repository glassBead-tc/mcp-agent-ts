import path from 'path';
import { MCPApp } from '../../src/app';
import { getLogger } from '../../src/logging/logger';
import { Agent } from '../../src/agents/agent';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/augmented_llm_openai';
import { LLMRouter } from '../../src/workflows/router/router_llm';

const app = new MCPApp({ name: "router" });

// Simple function that prints a message to the console
function printToConsole(message: string): void {
  const logger = getLogger("workflow_router.print_to_console");
  logger.info(message);
}

// Simple function that prints "Hello, world!" to the console
function printHelloWorld(): void {
  printToConsole("Hello, world!");
}

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

    // Create agents for different purposes
    const finderAgent = new Agent({
      name: "finder",
      instruction: `You are an agent with access to the filesystem, 
      as well as the ability to fetch URLs. Your job is to identify 
      the closest match to a user's request, make the appropriate tool calls, 
      and return the URI and CONTENTS of the closest match.`,
      serverNames: ["fetch", "filesystem"],
      context
    });

    const writerAgent = new Agent({
      name: "writer",
      instruction: `You are an agent that can write to the filesystem.
      You are tasked with taking the user's input, addressing it, and 
      writing the result to disk in the appropriate location.`,
      serverNames: ["filesystem"],
      context
    });

    const reasoningAgent = new Agent({
      name: "reasoning",
      instruction: `You are a generalist with knowledge about a vast
      breadth of subjects. You are tasked with analyzing and reasoning over
      the user's query and providing a thoughtful response.`,
      serverNames: [],
      context
    });

    // Initialize all agents
    await Promise.all([
      finderAgent.initialize(),
      writerAgent.initialize(),
      reasoningAgent.initialize()
    ]);

    // Create an LLM for the router
    const llm = new OpenAIAugmentedLLM({
      agent: reasoningAgent, // Use the reasoning agent for the LLM
      model: context.config.openai?.default_model || 'gpt-4o',
      apiKey: context.config.openai?.api_key,
      baseUrl: context.config.openai?.base_url
    });

    // Create a router with the LLM
    const router = new LLMRouter({
      llm,
      agents: [finderAgent, writerAgent, reasoningAgent],
      functions: [printToConsole, printHelloWorld]
    });

    // Route a request to an agent
    // This should route the query to finder agent, and also give an explanation of its decision
    const agentResults = await router.routeToAgent(
      "Print the contents of mcp_agent.config.yaml verbatim",
      1 // top_k=1
    );
    logger.info("Router Results (Agent):", { data: agentResults });

    // Use the agent returned by the router
    const agent = agentResults[0].result;
    
    // List available tools
    const toolsResult = await agent.listTools();
    logger.info("Tools available:", { data: toolsResult });

    // Call the read_file tool
    const readFileResult = await agent.callTool(
      "filesystem:read_file",
      { path: path.join(process.cwd(), "mcp_agent.config.yaml") }
    );
    logger.info("read_file result:", { data: readFileResult });

    // Route a request to a function
    // This should route the query to printToConsole function
    const functionResults = await router.routeToFunction(
      "Print the input to console",
      2 // top_k=2
    );
    logger.info("Router Results (Function):", { data: functionResults });

    // Call the function returned by the router
    const functionToCall = functionResults[0].result;
    functionToCall("Hello, world!");

    // Route a request across both agents and functions
    // Using the 'route' function will return the top-k results across all categories
    const generalResults = await router.route(
      "Print the contents of mcp_agent.config.yaml verbatim",
      3 // top_k=3
    );
    logger.info("Router Results (General):", { data: generalResults });

    // Shutdown all agents
    await Promise.all([
      finderAgent.shutdown(),
      writerAgent.shutdown(),
      reasoningAgent.shutdown()
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
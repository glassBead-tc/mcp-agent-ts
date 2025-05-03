import { 
  Content, 
  EmbeddedResource, 
  ImageContent, 
  InitializationOptions, 
  NotificationOptions, 
  Server, 
  TextContent, 
  Tool
} from '@modelcontextprotocol/sdk';
import * as stdio from '@modelcontextprotocol/sdk/stdio';
import { MCPApp } from '../../src/app';
import { Agent } from '../../src/agents/agent';
import { OpenAIAugmentedLLM } from '../../src/workflows/llm/augmented_llm_openai';
import { Orchestrator } from '../../src/workflows/orchestrator/orchestrator';
import { ParallelLLM } from '../../src/workflows/parallel/parallel_llm';
import { LLMRouter } from '../../src/workflows/router/router_llm';

const server = new Server('mcp_agent');
const app = new MCPApp({ name: 'mcp_server' });

// Define the tools that this server provides
server.onListTools(async () => {
  return [
    {
      name: 'call_agent',
      description: 'Call an agent to generate a response',
      inputSchema: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Name of an agent to call.',
          },
          instruction: {
            type: 'string',
            description: 'Instructions for the agent',
          },
          message: {
            type: 'string',
            description: 'Message to pass to an agent',
          },
          server_names: {
            type: 'array',
            description: 'The MCP server to equip the agent with.',
            items: {
              type: 'string',
              description: 'The name of a MCP server.',
            },
            uniqueItems: true,
          },
        },
        required: ['agent_name', 'instruction', 'message'],
      },
    },
    {
      name: 'list_servers',
      description: 'List all possible MCP servers that agent can use.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'parallel_workflow',
      description: 'Construct a workflows where tasks are fan-out to multiple agents and the results are aggregated by an aggregator agent.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_names: {
            type: 'array',
            description: 'The names of the agents to call.',
            items: {
              type: 'string',
              description: 'The name of an agent.',
            },
            uniqueItems: true,
          },
          instructions: {
            type: 'array',
            description: 'Instructions for the agents',
            items: {
              type: 'string',
              description: 'The instruction for each of the agents.',
            },
          },
          server_names: {
            type: 'array',
            description: 'A list of MCP server lists to equip each agent with. If an agent does not require MCP servers, give it an empty list.',
            items: {
              type: 'array',
              description: 'The list of the MCP servers to equip the agent with.',
              items: {
                type: 'string',
                description: 'The name of a MCP server.',
              },
            },
          },
          message: {
            type: 'string',
            description: 'Message to pass to each of the agents.',
          },
          aggregator_agent: {
            type: 'object',
            description: 'The agent to aggregate the results.',
            properties: {
              agent_name: {
                type: 'string',
                description: 'The name of the agent.',
              },
              instruction: {
                type: 'string',
                description: 'The instruction for the agent.',
              },
              server_names: {
                type: 'array',
                description: 'The MCP server to equip the agent with.',
                items: {
                  type: 'string',
                  description: 'The name of a MCP server.',
                },
                uniqueItems: true,
              },
            },
            required: ['agent_name', 'instruction', 'server_names'],
          },
        },
        required: [
          'agent_names',
          'instructions',
          'message',
          'aggregator_agent',
        ],
      },
    },
    {
      name: 'router_workflow',
      description: 'Given an input, find the most relevant agent.',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message to the router.',
          },
          top_k: {
            type: 'integer',
            description: 'The number of agents to route the message to based on relevance.',
            minimum: 1,
          },
          agent_names: {
            type: 'array',
            description: 'The names of the agents to call.',
            items: {
              type: 'string',
              description: 'The name of an agent.',
            },
            uniqueItems: true,
          },
          instructions: {
            type: 'array',
            description: 'Instructions for the agents',
            items: {
              type: 'string',
              description: 'The instruction for each of the agents.',
            },
          },
          server_names: {
            type: 'array',
            description: 'A list of MCP server lists to equip each agent with. If an agent does not require MCP servers, give it an empty list.',
            items: {
              type: 'array',
              description: 'The list of the MCP servers to equip the agent with.',
              items: {
                type: 'string',
                description: 'The name of a MCP server.',
              },
            },
          },
        },
        required: [
          'message',
          'top_k',
          'agent_names',
          'instructions',
        ],
      },
    },
    {
      name: 'orchestrator_workflow',
      description: 'Construct a workflow where a higher llm breaks tasks into steps, assigns them to agents, and merges results.',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message to the orchestrator.',
          },
          agent_names: {
            type: 'array',
            description: 'The names of the agents that can be called.',
            items: {
              type: 'string',
              description: 'The name of an agent.',
            },
          },
          instructions: {
            type: 'array',
            description: 'Instructions for the agents',
            items: {
              type: 'string',
              description: 'The instruction for each of the agents.',
            },
          },
          server_names: {
            type: 'array',
            description: 'A list of MCP server lists to equip each agent with. If an agent does not require MCP servers, give it an empty list.',
            items: {
              type: 'array',
              description: 'The list of the MCP servers to equip the agent with.',
              items: {
                type: 'string',
                description: 'The name of a MCP server.',
              },
            },
          },
        },
        required: ['message', 'agent_names', 'instructions'],
      },
    },
  ];
});

// Implement the parallel workflow handler
async function runParallelWorkflow(arguments_: Record<string, any>): Promise<TextContent[]> {
  const agentNames = arguments_.agent_names;
  const instructions = arguments_.instructions;
  const message = arguments_.message;
  const serverNames = arguments_.server_names;
  const aggregatorAgent = arguments_.aggregator_agent;

  // Validate inputs
  if (!Array.isArray(agentNames)) {
    throw new Error('agent_names must be a list');
  } else if (!agentNames.every(name => typeof name === 'string')) {
    throw new Error('Each agent_name must be a string');
  } else if (!Array.isArray(instructions)) {
    throw new Error('instructions must be a list');
  } else if (!instructions.every(instruction => typeof instruction === 'string')) {
    throw new Error('Each instruction must be a string');
  } else if (typeof message !== 'string') {
    throw new Error('message must be a string');
  } else if (agentNames.length !== instructions.length) {
    throw new Error('agent_names and instructions must have the same length');
  } else if (serverNames && agentNames.length !== serverNames.length) {
    throw new Error('agent_names and server_names must have the same length');
  }

  // Set default server names if not provided
  const servers = serverNames || agentNames.map(() => []);

  // Create agents
  const fanOutAgents = agentNames.map((agentName, index) => {
    return new Agent({
      name: agentName,
      instruction: instructions[index],
      serverNames: servers[index],
      context: app.context
    });
  });

  // Create aggregator agent
  const fanInAgent = new Agent({
    name: aggregatorAgent.agent_name,
    instruction: aggregatorAgent.instruction,
    serverNames: aggregatorAgent.server_names,
    context: app.context
  });

  // Initialize all agents
  await Promise.all([
    ...fanOutAgents.map(agent => agent.initialize()),
    fanInAgent.initialize()
  ]);

  // Create and run parallel workflow
  const parallel = new ParallelLLM({
    fanInAgent: fanInAgent,
    fanOutAgents: fanOutAgents,
    llmFactory: async (agent) => {
      return new OpenAIAugmentedLLM({
        agent,
        model: app.context.config.openai?.default_model || 'gpt-4o',
        apiKey: app.context.config.openai?.api_key,
        baseUrl: app.context.config.openai?.base_url
      });
    }
  });

  // Generate and return result
  try {
    const result = await parallel.runConversation([
      { role: 'user', content: message }
    ]);
    const response = result[result.length - 1].content;
    return [{ type: 'text', text: response }];
  } finally {
    // Clean up agents
    await Promise.all([
      ...fanOutAgents.map(agent => agent.shutdown()),
      fanInAgent.shutdown()
    ]);
  }
}

// Implement the list servers handler
function runListServers(): TextContent[] {
  const context = app.context;
  const servers = Object.keys(context.config.mcp?.servers || {});
  return [{ type: 'text', text: servers.join('\n') }];
}

// Implement the call agent handler
async function runCallAgent(arguments_: Record<string, any>): Promise<TextContent[]> {
  const agentName = arguments_.agent_name;
  const instruction = arguments_.instruction;
  const message = arguments_.message;
  const serverNames = arguments_.server_names;

  // Validate inputs
  if (!agentName) {
    throw new Error('Missing agent_name parameter');
  } else if (!instruction) {
    throw new Error('Missing instruction parameter');
  } else if (!message) {
    throw new Error('Missing message parameter');
  }

  // Create and initialize agent
  const agent = new Agent({
    name: agentName,
    instruction: instruction,
    serverNames: serverNames,
    context: app.context
  });

  await agent.initialize();

  try {
    // Create LLM and generate response
    const llm = await agent.attachLLM(async (agent) => {
      return new OpenAIAugmentedLLM({
        agent,
        model: app.context.config.openai?.default_model || 'gpt-4o',
        apiKey: app.context.config.openai?.api_key,
        baseUrl: app.context.config.openai?.base_url
      });
    });

    const result = await llm.runConversation([
      { role: 'user', content: message }
    ]);
    
    const response = result[result.length - 1].content;
    return [{ type: 'text', text: response }];
  } finally {
    // Clean up agent
    await agent.shutdown();
  }
}

// Implement the router workflow handler
async function runRouterWorkflow(arguments_: Record<string, any>): Promise<TextContent[]> {
  const agentNames = arguments_.agent_names;
  const instructions = arguments_.instructions;
  const message = arguments_.message;
  const topK = arguments_.top_k;
  const serverNames = arguments_.server_names;

  // Validate inputs
  if (!Array.isArray(agentNames)) {
    throw new Error('agent_names must be a list');
  } else if (!Array.isArray(instructions)) {
    throw new Error('instructions must be a list');
  } else if (typeof message !== 'string') {
    throw new Error('message must be a string');
  } else if (typeof topK !== 'number') {
    throw new Error('top_k must be an integer');
  }

  // Set default server names if not provided
  const servers = serverNames || agentNames.map(() => []);

  // Create agents
  const agents = agentNames.map((agentName, index) => {
    return new Agent({
      name: agentName,
      instruction: instructions[index],
      serverNames: servers[index],
      context: app.context
    });
  });

  // Initialize all agents
  await Promise.all(agents.map(agent => agent.initialize()));

  try {
    // Create router LLM
    const routerLLM = new OpenAIAugmentedLLM({
      agent: agents[0], // Use the first agent for the LLM
      model: app.context.config.openai?.default_model || 'gpt-4o',
      apiKey: app.context.config.openai?.api_key,
      baseUrl: app.context.config.openai?.base_url
    });

    // Create router and route the message
    const router = new LLMRouter({
      llm: routerLLM,
      agents
    });
    
    const responses = await router.routeToAgent(message, topK);

    // Format results
    const result = responses.map(response => {
      return `Agent: ${response.result.name}\nConfidence: ${response.score}\nReasoning: ${response.metadata?.reasoning || 'No reasoning provided'}`;
    }).join('\n\n---\n\n');

    return [{ type: 'text', text: result }];
  } finally {
    // Clean up agents
    await Promise.all(agents.map(agent => agent.shutdown()));
  }
}

// Implement the orchestrator workflow handler
async function runOrchestratorWorkflow(arguments_: Record<string, any>): Promise<TextContent[]> {
  const agentNames = arguments_.agent_names;
  const instructions = arguments_.instructions;
  const message = arguments_.message;
  const serverNames = arguments_.server_names;

  // Validate inputs
  if (!Array.isArray(agentNames)) {
    throw new Error('agent_names must be a list');
  } else if (!Array.isArray(instructions)) {
    throw new Error('instructions must be a list');
  } else if (typeof message !== 'string') {
    throw new Error('message must be a string');
  }

  // Set default server names if not provided
  const servers = serverNames || agentNames.map(() => []);

  // Create agents
  const agents = agentNames.map((agentName, index) => {
    return new Agent({
      name: agentName,
      instruction: instructions[index],
      serverNames: servers[index],
      context: app.context
    });
  });

  // Initialize all agents
  await Promise.all(agents.map(agent => agent.initialize()));

  try {
    // Create orchestrator and run workflow
    const orchestrator = new Orchestrator({
      llmFactory: async (agent) => {
        return new OpenAIAugmentedLLM({
          agent,
          model: app.context.config.openai?.default_model || 'gpt-4o',
          apiKey: app.context.config.openai?.api_key,
          baseUrl: app.context.config.openai?.base_url
        });
      },
      availableAgents: agents
    });

    const result = await orchestrator.runConversation([
      { role: 'user', content: message }
    ]);
    
    const response = result[result.length - 1].content;
    return [{ type: 'text', text: response }];
  } finally {
    // Clean up agents
    await Promise.all(agents.map(agent => agent.shutdown()));
  }
}

// Handle tool calls
server.onCallTool(async (name, arguments_) => {
  if (!arguments_) {
    throw new Error('Missing arguments');
  }

  try {
    await app.initialize();
    
    switch (name) {
      case 'call_agent':
        return await runCallAgent(arguments_);
      case 'list_servers':
        return runListServers();
      case 'parallel_workflow':
        return await runParallelWorkflow(arguments_);
      case 'router_workflow':
        return await runRouterWorkflow(arguments_);
      case 'orchestrator_workflow':
        return await runOrchestratorWorkflow(arguments_);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Main function to start the server
async function main() {
  const { readStream, writeStream } = await stdio.createStdioTransport();
  
  await server.run(
    readStream,
    writeStream,
    new InitializationOptions({
      server_name: 'mcp_agent',
      server_version: '0.1.0',
      capabilities: server.getCapabilities(
        new NotificationOptions(),
        {}
      )
    })
  );
}

// Start the server
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
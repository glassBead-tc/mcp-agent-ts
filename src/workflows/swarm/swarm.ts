/**
 * Swarm implementation for orchestrating agents that can use tools via MCP servers
 * 
 * MCP version of the OpenAI Swarm class (https://github.com/openai/swarm)
 */
import { Agent } from '../../agents/agent';
import { AugmentedLLM, Message, CompletionOptions } from '../llm/augmented_llm';
import { Context } from '../../context';
import { getLogger } from '../../logging/logger';

const logger = getLogger('swarm');

/**
 * Type for agent function return values
 */
export type AgentFunctionReturnType = string | Agent | Record<string, any> | AgentFunctionResult;

/**
 * Type for agent function callable
 */
export type AgentFunctionCallable = () => Promise<AgentFunctionReturnType>;

/**
 * Encapsulates the possible return values for a Swarm agent function
 */
export class AgentFunctionResult {
  /**
   * The result value as a string
   */
  value: string = "";
  
  /**
   * The agent instance, if applicable
   */
  agent?: Agent;
  
  /**
   * A dictionary of context variables
   */
  contextVariables: Record<string, string> = {};
  
  /**
   * Create a new agent function result
   * 
   * @param options - Options for the result
   * @param options.value - The result value as a string
   * @param options.agent - The agent instance, if applicable
   * @param options.contextVariables - A dictionary of context variables
   */
  constructor(options: {
    value?: string;
    agent?: Agent;
    contextVariables?: Record<string, string>;
  } = {}) {
    this.value = options.value || "";
    this.agent = options.agent;
    this.contextVariables = options.contextVariables || {};
  }
}

/**
 * A resource that returns an agent
 */
export interface AgentResource {
  type: string;
  agent?: Agent;
  resource: {
    text: string;
    uri: string;
  };
}

/**
 * A resource that returns an AgentFunctionResult
 */
export interface AgentFunctionResultResource {
  type: string;
  result: AgentFunctionResult;
  resource: {
    text: string;
    uri: string;
  };
}

/**
 * Create an agent resource
 * 
 * @param agent - The agent to create a resource for
 * @returns The agent resource
 */
export function createAgentResource(agent: Agent): AgentResource {
  return {
    type: "resource",
    agent,
    resource: {
      text: `You are now Agent '${agent.name}'. Please review the messages and continue execution`,
      uri: "http://fake.url", // Required property but not needed
    },
  };
}

/**
 * Create an agent function result resource
 * 
 * @param result - The result to create a resource for
 * @returns The agent function result resource
 */
export function createAgentFunctionResultResource(
  result: AgentFunctionResult
): AgentFunctionResultResource {
  return {
    type: "resource",
    result,
    resource: {
      text: result.value || (result.agent?.name || "AgentFunctionResult"),
      uri: "http://fake.url", // Required property but not needed
    },
  };
}

/**
 * A SwarmAgent is an Agent that can spawn other agents and interactively resolve a task
 * 
 * SwarmAgents have access to tools available on the servers they are connected to, but additionally
 * have a list of (possibly local) functions that can be called as tools.
 */
export class SwarmAgent extends Agent {
  parallelToolCalls: boolean;
  
  /**
   * Create a new swarm agent
   * 
   * @param options - Options for the agent
   * @param options.name - The name of the agent
   * @param options.instruction - The instruction for the agent
   * @param options.serverNames - List of server names to connect to
   * @param options.functions - List of agent functions to expose as tools
   * @param options.parallelToolCalls - Whether to execute tool calls in parallel
   * @param options.humanInputCallback - Callback for human input
   * @param options.context - Context to use
   */
  constructor(options: {
    name: string;
    instruction?: string | ((context: Record<string, any>) => string);
    serverNames?: string[];
    functions?: Function[];
    parallelToolCalls?: boolean;
    humanInputCallback?: (request: any) => Promise<any>;
    context?: Context;
  }) {
    super({
      name: options.name,
      instruction: options.instruction || "You are a helpful agent.",
      serverNames: options.serverNames || [],
      functions: options.functions || [],
      connectionPersistence: false, // SwarmAgent can't maintain connection persistence
      humanInputCallback: options.humanInputCallback,
      context: options.context
    });
    
    this.parallelToolCalls = options.parallelToolCalls || false;
  }
  
  /**
   * Call a tool by name with arguments
   * 
   * @param name - The name of the tool to call
   * @param arguments_ - The arguments to pass to the tool
   * @returns The result of the tool call
   */
  async callTool(name: string, arguments_: Record<string, any> | null = null): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check if this is a function tool
    const functionToolMap = (this as any).functionToolMap as Map<string, any>;
    if (functionToolMap.has(name)) {
      const tool = functionToolMap.get(name);
      const result = await tool.run(arguments_ || {});
      
      logger.debug(`Function tool ${name} result:`, { result });
      
      if (result instanceof Agent || result instanceof SwarmAgent) {
        const resource = createAgentResource(result);
        return {
          content: [resource]
        };
      } else if (result instanceof AgentFunctionResult) {
        const resource = createAgentFunctionResultResource(result);
        return {
          content: [resource]
        };
      } else if (typeof result === 'string') {
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      } else if (typeof result === 'object') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      } else {
        logger.warn(`Unknown result type: ${result}, returning as text.`);
        return {
          content: [{
            type: "text",
            text: String(result)
          }]
        };
      }
    }
    
    // If not a function tool, call the parent method
    return super.callTool(name, arguments_);
  }
}

/**
 * A special agent that represents the end of a Swarm workflow
 */
export class DoneAgent extends SwarmAgent {
  /**
   * Create a new done agent
   */
  constructor() {
    super({
      name: "__done__",
      instruction: "Swarm Workflow is complete."
    });
  }
  
  /**
   * Override call tool to always return completion message
   */
  async callTool(_name: string, _arguments: Record<string, any> | null = null): Promise<any> {
    return {
      content: [{
        type: "text",
        text: "Workflow is complete."
      }]
    };
  }
}

/**
 * Handles orchestrating agents that can use tools via MCP servers
 * 
 * MCP version of the OpenAI Swarm class
 */
export class Swarm extends AugmentedLLM {
  protected contextVariables: Record<string, string>;
  
  /**
   * Initialize the LLM planner with an agent
   * 
   * @param options - Options for the swarm
   * @param options.agent - The agent to use as the starting point
   * @param options.contextVariables - Initial context variables
   */
  constructor(options: {
    agent: SwarmAgent;
    contextVariables?: Record<string, string>;
  }) {
    super({
      agent: options.agent,
      model: 'swarm' // Placeholder
    });
    
    this.contextVariables = options.contextVariables || {};
    
    // Set instruction based on agent's instruction
    if (typeof options.agent.instruction === 'function') {
      this.instruction = options.agent.instruction(this.contextVariables);
    } else {
      this.instruction = options.agent.instruction;
    }
    
    logger.debug(`Swarm initialized with agent ${options.agent.name}`, {
      contextVariables: this.contextVariables,
      instruction: this.instruction
    });
  }
  
  /**
   * Get the schema for a tool by name
   * 
   * @param toolName - The name of the tool to get
   * @returns The tool schema, or undefined if not found
   */
  async getTool(toolName: string): Promise<any | undefined> {
    const result = await this.agent.listTools();
    
    for (const tool of result.tools) {
      if (tool.name === toolName) {
        return tool;
      }
    }
    
    return undefined;
  }
  
  /**
   * Process a request before making a tool call
   * 
   * @param toolCallId - The ID of the tool call
   * @param request - The tool call request
   * @returns The modified request, or false to abort
   */
  async preToolCall(toolCallId: string | null, request: any): Promise<any | boolean> {
    if (!this.agent) {
      // If there are no agents, we can't do anything, so we should bail
      return false;
    }
    
    const tool = await this.getTool(request.params.name);
    if (!tool) {
      logger.warn(`Warning: Tool '${request.params.name}' not found in agent '${this.agent.name}' tools. Proceeding with original request params.`);
      return request;
    }
    
    // If the tool has a "context_variables" parameter, we set it to our context variables state
    if (tool.inputSchema && tool.inputSchema.properties && 'context_variables' in tool.inputSchema.properties) {
      logger.debug(`Setting context variables on tool_call '${request.params.name}'`, {
        contextVariables: this.contextVariables
      });
      
      if (!request.params.arguments) {
        request.params.arguments = {};
      }
      
      request.params.arguments.context_variables = this.contextVariables;
    }
    
    return request;
  }
  
  /**
   * Process a result after making a tool call
   * 
   * @param toolCallId - The ID of the tool call
   * @param request - The tool call request
   * @param result - The tool call result
   * @returns The modified result
   */
  async postToolCall(toolCallId: string | null, request: any, result: any): Promise<any> {
    const contents = [];
    
    for (const content of result.content) {
      if (content.type === 'resource' && content.agent) {
        // Handle AgentResource
        await this.setAgent(content.agent);
        contents.push({
          type: "text",
          text: content.resource.text
        });
      } else if (content.type === 'resource' && content.result) {
        // Handle AgentFunctionResultResource
        logger.info("Updating context variables with new context variables from agent function result", {
          contextVariables: content.result.contextVariables
        });
        
        Object.assign(this.contextVariables, content.result.contextVariables);
        
        if (content.result.agent) {
          // Set the new agent as the current agent
          await this.setAgent(content.result.agent);
        }
        
        contents.push({
          type: "text",
          text: content.resource.text
        });
      } else {
        contents.push(content);
      }
    }
    
    result.content = contents;
    return result;
  }
  
  /**
   * Set a new agent as the current agent
   * 
   * @param agent - The agent to set
   */
  async setAgent(agent: SwarmAgent): Promise<void> {
    logger.info(`Switching from agent '${this.agent.name}' -> agent '${agent ? agent.name : 'NULL'}'`);
    
    if (this.agent) {
      // Close the current agent
      await this.agent.shutdown();
    }
    
    // Initialize the new agent (if it's not None)
    this.agent = agent;
    
    if (!this.agent || this.agent instanceof DoneAgent) {
      this.instruction = undefined;
      return;
    }
    
    await this.agent.initialize();
    
    if (typeof agent.instruction === 'function') {
      this.instruction = agent.instruction(this.contextVariables);
    } else {
      this.instruction = agent.instruction;
    }
  }
  
  /**
   * Returns true if the workflow should continue, false otherwise
   */
  shouldContinue(): boolean {
    if (!this.agent || this.agent instanceof DoneAgent) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Complete a conversation
   * 
   * This is a placeholder implementation - swarm implementations will override this
   */
  async complete(messages: Message[], options?: CompletionOptions): Promise<any> {
    throw new Error("The base Swarm class does not implement complete(). Use a provider-specific implementation like AnthropicSwarm or OpenAISwarm.");
  }
  
  /**
   * Complete a conversation with tool calling
   * 
   * This is a placeholder implementation - swarm implementations will override this
   */
  async completeWithTools(messages: Message[], options?: CompletionOptions): Promise<any> {
    throw new Error("The base Swarm class does not implement completeWithTools(). Use a provider-specific implementation like AnthropicSwarm or OpenAISwarm.");
  }
}
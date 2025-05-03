/**
 * Swarm implementation for MCP Agent
 * 
 * Based on OpenAI's Swarm pattern for multi-agent workflows.
 */
import { Agent } from '../../agents/agent';
import { HumanInputCallback } from '../../types';
import { getLogger } from '../../logging/logger';
import { AugmentedLLM, Message, CompletionOptions, CompletionResult } from '../llm/augmented_llm';

const logger = getLogger('swarm');

/**
 * Agent resource interface
 */
export interface AgentResource {
  type: string;
  agent: Agent | null;
  resource: {
    text: string;
    uri: string;
  };
}

/**
 * Agent function result interface
 */
export interface AgentFunctionResult {
  value: string;
  agent: Agent | null;
  contextVariables: Record<string, string>;
}

/**
 * Agent function result resource interface
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
 */
export function createAgentResource(agent: Agent): AgentResource {
  return {
    type: 'resource',
    agent,
    resource: {
      text: `You are now Agent '${agent.name}'. Please review the messages and continue execution`,
      uri: 'http://fake.url', // Required property but not needed
    },
  };
}

/**
 * Create an agent function result resource
 */
export function createAgentFunctionResultResource(result: AgentFunctionResult): AgentFunctionResultResource {
  return {
    type: 'resource',
    result,
    resource: {
      text: result.value || result.agent?.name || 'AgentFunctionResult',
      uri: 'http://fake.url', // Required property but not needed
    },
  };
}

/**
 * Agent function return type
 */
export type AgentFunctionReturnType = string | Agent | Record<string, any> | AgentFunctionResult;

/**
 * Agent function callable
 */
export type AgentFunctionCallable = () => Promise<AgentFunctionReturnType> | AgentFunctionReturnType;

/**
 * Tool interface
 */
export interface Tool {
  name: string;
  description: string;
  agentResource?: AgentResource;
  agentFunction?: AgentFunctionCallable;
  inputSchema?: Record<string, any>;
}

/**
 * Call tool request interface
 */
export interface CallToolRequest {
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

/**
 * Call tool result interface
 */
export interface CallToolResult {
  content: any[];
  isError?: boolean;
}

/**
 * Text content interface
 */
export interface TextContent {
  type: string;
  text: string;
}

/**
 * Special agent type that indicates the current workflow is done
 */
export class DoneAgent extends SwarmAgent {
  constructor() {
    super({
      name: '__done__',
      instruction: 'Swarm Workflow is complete.'
    });
  }

  async callTool(_name: string, _arguments?: Record<string, any>): Promise<CallToolResult> {
    return {
      content: [{ type: 'text', text: 'Workflow is complete.' }]
    };
  }
}

/**
 * Swarm Agent class
 * 
 * Extends Agent to provide additional functionality for swarm workflows
 */
export class SwarmAgent extends Agent {
  parallelToolCalls: boolean;
  
  /**
   * Create a new Swarm Agent
   * 
   * @param options - Swarm Agent options
   * @param options.name - The name of the agent
   * @param options.instruction - The instruction for the agent
   * @param options.serverNames - List of MCP server names to connect to
   * @param options.functions - List of functions to expose as tools
   * @param options.connectionPersistence - Whether to keep connections to MCP servers open
   * @param options.humanInputCallback - Callback for handling human input requests
   * @param options.context - The context to use
   * @param options.parallelToolCalls - Whether to allow parallel tool calls
   */
  constructor(options: {
    name: string;
    instruction: string | ((context: Record<string, any>) => string);
    serverNames?: string[];
    functions?: Function[];
    connectionPersistence?: boolean;
    humanInputCallback?: HumanInputCallback;
    context?: any;
    parallelToolCalls?: boolean;
  }) {
    super({
      name: options.name,
      instruction: options.instruction,
      serverNames: options.serverNames,
      functions: options.functions,
      connectionPersistence: options.connectionPersistence ?? false,
      humanInputCallback: options.humanInputCallback,
      context: options.context,
    });
    
    this.parallelToolCalls = options.parallelToolCalls ?? true;
  }

  /**
   * Call a tool
   * 
   * @param name - The name of the tool to call
   * @param arguments - The arguments to pass to the tool
   * @returns The result of the tool call
   */
  async callTool(name: string, arguments?: Record<string, any>): Promise<CallToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if the tool is a function tool
    if (this._functionToolMap && this._functionToolMap[name]) {
      const tool = this._functionToolMap[name];
      const result = await tool.run(arguments);

      logger.debug(`Function tool ${name} result:`, { data: result });

      // Handle different result types
      if (result instanceof Agent || result instanceof SwarmAgent) {
        const resource = createAgentResource(result);
        return { content: [resource] };
      } else if (this.isAgentFunctionResult(result)) {
        const resource = createAgentFunctionResultResource(result as AgentFunctionResult);
        return { content: [resource] };
      } else if (typeof result === 'string') {
        return { content: [{ type: 'text', text: result }] };
      } else if (typeof result === 'object') {
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } else {
        logger.warning(`Unknown result type: ${result}, returning as text.`);
        return { content: [{ type: 'text', text: String(result) }] };
      }
    }

    // Otherwise, call the base Agent's callTool method
    return super.callTool(name, arguments);
  }

  /**
   * Check if a value is an AgentFunctionResult
   * 
   * @param value - The value to check
   * @returns Whether the value is an AgentFunctionResult
   */
  private isAgentFunctionResult(value: any): boolean {
    return (
      value !== null && 
      typeof value === 'object' && 
      'value' in value && 
      'agent' in value && 
      'contextVariables' in value
    );
  }
}

/**
 * Request parameters interface
 */
export interface RequestParams {
  model: string;
  maxTokens?: number;
  temperature?: number;
  parallelToolCalls?: boolean;
  maxIterations?: number;
  [key: string]: any;
}

/**
 * Swarm class
 * 
 * Handles orchestrating agents that can use tools via MCP servers.
 * MCP version of the OpenAI Swarm class.
 */
export class Swarm extends AugmentedLLM {
  contextVariables: Record<string, string>;
  instruction: string | null;
  
  /**
   * Create a new Swarm
   * 
   * @param options - Swarm options
   * @param options.agent - The agent to use
   * @param options.contextVariables - The context variables to use
   * @param options.model - The model to use
   * @param options.apiKey - The API key to use
   * @param options.baseUrl - The base URL to use
   * @param options.options - Additional options
   */
  constructor(options: {
    agent: SwarmAgent;
    contextVariables?: Record<string, string>;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    super({
      agent: options.agent,
      model: options.model,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      options: options.options,
    });
    
    this.contextVariables = options.contextVariables || {};
    this.instruction = this.getInstruction();
    
    logger.debug(`Swarm initialized with agent ${options.agent.name}`, {
      contextVariables: this.contextVariables,
      instruction: this.instruction,
    });
  }

  /**
   * Complete a conversation
   * 
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    throw new Error('Method not implemented. Use a specific LLM implementation like AnthropicSwarm.');
  }

  /**
   * Complete a conversation with tool calling
   * 
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async completeWithTools(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    throw new Error('Method not implemented. Use a specific LLM implementation like AnthropicSwarm.');
  }

  /**
   * Generate a response
   * 
   * @param message - The message to generate a response for
   * @param requestParams - Request parameters
   * @returns The generated response
   */
  async generate(message: string, requestParams?: RequestParams): Promise<string> {
    throw new Error('Method not implemented. Use a specific LLM implementation like AnthropicSwarm.');
  }

  /**
   * Get a tool by name
   * 
   * @param toolName - The name of the tool to get
   * @returns The tool, or null if not found
   */
  async getTool(toolName: string): Promise<Tool | null> {
    const result = await this.agent.listTools();
    
    for (const tool of result.tools) {
      if (tool.name === toolName) {
        return tool;
      }
    }
    
    return null;
  }

  /**
   * Pre-process a tool call
   * 
   * @param toolCallId - The ID of the tool call
   * @param request - The tool call request
   * @returns The processed request, or false if the request should be ignored
   */
  async preToolCall(
    toolCallId: string | null,
    request: CallToolRequest
  ): Promise<CallToolRequest | boolean> {
    if (!this.agent) {
      // If there are no agents, we can't do anything, so we should bail
      return false;
    }

    const tool = await this.getTool(request.params.name);
    
    if (!tool) {
      logger.warning(
        `Warning: Tool '${request.params.name}' not found in agent '${this.agent.name}' tools. Proceeding with original request params.`
      );
      return request;
    }

    // If the tool has a "contextVariables" parameter, we set it to our context variables state
    if (tool.inputSchema && 'contextVariables' in tool.inputSchema) {
      logger.debug(
        `Setting context variables on tool_call '${request.params.name}'`,
        { data: this.contextVariables }
      );
      request.params.arguments['contextVariables'] = this.contextVariables;
    }

    return request;
  }

  /**
   * Post-process a tool call
   * 
   * @param toolCallId - The ID of the tool call
   * @param request - The tool call request
   * @param result - The tool call result
   * @returns The processed result
   */
  async postToolCall(
    toolCallId: string | null,
    request: CallToolRequest,
    result: CallToolResult
  ): Promise<CallToolResult> {
    const contents = [];
    
    for (const content of result.content) {
      if (this.isAgentResource(content)) {
        // Set the new agent as the current agent
        await this.setAgent(content.agent);
        contents.push({ type: 'text', text: content.resource.text });
      } else if (this.isAgentFunctionResult(content)) {
        logger.info(
          'Updating context variables with new context variables from agent function result',
          { data: content.result.contextVariables }
        );
        
        Object.assign(this.contextVariables, content.result.contextVariables);
        
        if (content.result.agent) {
          // Set the new agent as the current agent
          await this.setAgent(content.result.agent);
        }
        
        contents.push({ type: 'text', text: content.resource.text });
      } else {
        contents.push(content);
      }
    }
    
    result.content = contents;
    return result;
  }

  /**
   * Set the agent
   * 
   * @param agent - The agent to set
   */
  async setAgent(agent: SwarmAgent): Promise<void> {
    logger.info(
      `Switching from agent '${this.agent.name}' -> agent '${agent ? agent.name : 'NULL'}'`
    );
    
    if (this.agent) {
      // Close the current agent
      await this.agent.shutdown();
    }
    
    // Initialize the new agent (if it's not null)
    this.agent = agent;
    
    if (!this.agent || this.agent instanceof DoneAgent) {
      this.instruction = null;
      return;
    }
    
    await this.agent.initialize();
    
    this.instruction = typeof agent.instruction === 'function'
      ? agent.instruction(this.contextVariables)
      : agent.instruction;
  }

  /**
   * Check if the workflow should continue
   * 
   * @returns Whether the workflow should continue
   */
  shouldContinue(): boolean {
    if (!this.agent || this.agent instanceof DoneAgent) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if a value is an AgentResource
   * 
   * @param value - The value to check
   * @returns Whether the value is an AgentResource
   */
  private isAgentResource(value: any): value is AgentResource {
    return (
      value !== null &&
      typeof value === 'object' &&
      value.type === 'resource' &&
      'agent' in value &&
      'resource' in value
    );
  }

  /**
   * Check if a value is an AgentFunctionResultResource
   * 
   * @param value - The value to check
   * @returns Whether the value is an AgentFunctionResultResource
   */
  private isAgentFunctionResult(value: any): value is AgentFunctionResultResource {
    return (
      value !== null &&
      typeof value === 'object' &&
      value.type === 'resource' &&
      'result' in value &&
      'resource' in value
    );
  }
}
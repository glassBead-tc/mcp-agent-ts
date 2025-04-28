/**
 * Augmented LLM base class for MCP Agent
 */
import { Agent } from '../../agents/agent.js';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('augmented_llm');

/**
 * Message interface
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

/**
 * Completion options
 */
export interface CompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  tools?: any[];
  tool_choice?: 'auto' | 'none' | { type: string; function: { name: string } };
  [key: string]: any;
}

/**
 * Completion result
 */
export interface CompletionResult {
  id: string;
  choices: {
    index: number;
    message: Message;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Base class for augmented LLMs
 */
export abstract class AugmentedLLM {
  protected agent: Agent;
  protected model: string;
  protected apiKey?: string;
  protected baseUrl?: string;
  protected options: Record<string, any>;
  
  constructor(
    options: {
      agent: Agent;
      model: string;
      apiKey?: string;
      baseUrl?: string;
      options?: Record<string, any>;
    }
  ) {
    this.agent = options.agent;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.options = options.options || {};
  }
  
  /**
   * Complete a conversation
   */
  abstract complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;
  
  /**
   * Complete a conversation with tool calling
   */
  abstract completeWithTools(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;
  
  /**
   * Run a conversation with tool calling
   */
  async runConversation(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<Message[]> {
    logger.debug('Running conversation', { messages });
    
    const allMessages = [...messages];
    let lastMessage = allMessages[allMessages.length - 1];
    
    // Get available tools
    const toolsResult = await this.agent.listTools();
    const tools = toolsResult.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
    
    // Run the conversation
    while (true) {
      // Complete with tools
      const completion = await this.completeWithTools(allMessages, {
        ...options,
        tools,
      });
      
      const assistantMessage = completion.choices[0].message;
      allMessages.push(assistantMessage);
      
      // Check if there are tool calls
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }
      
      // Process tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        logger.debug(`Calling tool ${toolName}`, { args: toolArgs });
        
        try {
          // Call the tool
          const result = await this.agent.callTool(toolName, toolArgs);
          
          // Add tool message
          const toolMessage: Message = {
            role: 'tool',
            content: result.isError
              ? `Error: ${result.content[0].text}`
              : result.content[0].text,
            tool_call_id: toolCall.id,
          };
          
          allMessages.push(toolMessage);
        } catch (error) {
          logger.error(`Error calling tool ${toolName}`, { error });
          
          // Add error message
          const errorMessage: Message = {
            role: 'tool',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            tool_call_id: toolCall.id,
          };
          
          allMessages.push(errorMessage);
        }
      }
    }
    
    return allMessages;
  }
  
  /**
   * Get the instruction for the agent
   */
  protected getInstruction(): string {
    const instruction = this.agent.instruction;
    
    if (typeof instruction === 'function') {
      return instruction({});
    }
    
    return instruction;
  }
}

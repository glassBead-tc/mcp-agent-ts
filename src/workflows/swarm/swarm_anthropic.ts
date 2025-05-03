/**
 * Anthropic implementation of Swarm
 */
import { Message, CompletionOptions, CompletionResult } from '../llm/augmented_llm';
import { AnthropicAugmentedLLM } from '../llm/augmented_llm_anthropic';
import { Swarm, SwarmAgent, RequestParams } from './swarm';
import { getLogger } from '../../logging/logger';

const logger = getLogger('swarm_anthropic');

/**
 * Anthropic implementation of Swarm
 * 
 * MCP version of the OpenAI Swarm class using Anthropic's API as the LLM.
 */
export class AnthropicSwarm extends Swarm {
  /**
   * Create a new Anthropic Swarm
   * 
   * @param options - Anthropic Swarm options
   * @param options.agent - The agent to use
   * @param options.contextVariables - The context variables to use
   * @param options.model - The model to use (defaults to 'claude-3-5-sonnet-20241022')
   * @param options.apiKey - The API key to use
   * @param options.baseUrl - The base URL to use
   * @param options.options - Additional options
   */
  constructor(options: {
    agent: SwarmAgent;
    contextVariables?: Record<string, string>;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    super({
      agent: options.agent,
      contextVariables: options.contextVariables,
      model: options.model || 'claude-3-5-sonnet-20241022',
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      options: options.options,
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
    logger.debug('Completing conversation with Anthropic', { 
      model: this.model,
      messageCount: messages.length,
    });
    
    try {
      // In a real implementation, we would use the Anthropic API here
      // For now, we'll just return a mock response
      
      // Get the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const userContent = lastUserMessage ? lastUserMessage.content : '';
      
      return {
        id: `anthropic-${Date.now()}`,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `This is a mock response from Anthropic Swarm (${this.model}) to: "${userContent}"`,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0, // Not tracked in mock
          completion_tokens: 0, // Not tracked in mock
          total_tokens: 0, // Not tracked in mock
        },
      };
    } catch (error) {
      logger.error('Error in Anthropic Swarm completion', { error });
      throw error;
    }
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
    logger.debug('Completing conversation with Anthropic Swarm (with tools)', { 
      model: this.model,
      messageCount: messages.length,
    });
    
    try {
      // In a real implementation, we would use the Anthropic API here
      // For now, we'll just return a mock response with a tool call
      
      // Get the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const userContent = lastUserMessage ? lastUserMessage.content : '';
      
      // Check if tools are provided
      const tools = options?.tools || [];
      
      if (tools.length === 0) {
        // No tools provided, just return a regular completion
        return this.complete(messages, options);
      }
      
      // Randomly decide whether to call a tool or not
      const shouldCallTool = Math.random() > 0.5;
      
      if (!shouldCallTool) {
        return {
          id: `anthropic-${Date.now()}`,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `This is a mock response from Anthropic Swarm (${this.model}) to: "${userContent}"`,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        };
      }
      
      // Pick a random tool
      const randomTool = tools[Math.floor(Math.random() * tools.length)];
      
      return {
        id: `anthropic-${Date.now()}`,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `I'll help you with that. Let me use a tool to get more information.`,
              tool_calls: [
                {
                  id: `call_${Date.now()}`,
                  type: 'function',
                  function: {
                    name: randomTool.function.name,
                    arguments: '{}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (error) {
      logger.error('Error in Anthropic Swarm completion with tools', { error });
      throw error;
    }
  }

  /**
   * Generate a response
   * 
   * @param message - The message to generate a response for
   * @param requestParams - Request parameters
   * @returns The generated response
   */
  async generate(message: string, requestParams?: RequestParams): Promise<string> {
    const params = this.getRequestParams(
      requestParams,
      {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        parallelToolCalls: false,
        maxIterations: 10,
      }
    );

    let iterations = 0;
    let response: string | null = null;
    let agentName = this.agent ? this.agent.name : null;

    while (iterations < (params.maxIterations || 10) && this.shouldContinue()) {
      // Generate a response
      const instructionMessage: Message = {
        role: 'system',
        content: this.instruction || 'You are a helpful assistant.'
      };

      const userMessage: Message = {
        role: 'user',
        content: iterations === 0 
          ? message 
          : 'Please resolve my original request. If it has already been resolved then end turn'
      };

      const messages = [instructionMessage, userMessage];
      
      // Start with the last 10 messages if there are more than 10
      if (iterations > 0 && this._previousMessages && this._previousMessages.length > 0) {
        const lastMessages = this._previousMessages.slice(-10);
        messages.push(...lastMessages);
      }

      // Call the language model
      const completion = await this.completeWithTools(
        messages,
        {
          temperature: params.temperature || 0.7,
          max_tokens: params.maxTokens || 8192,
          tools: await this.getTools(),
        }
      );

      // Get the response text
      const assistantMessage = completion.choices[0].message;
      response = assistantMessage.content || '';

      // Process tool calls if there are any
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, any> = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            logger.error(`Error parsing tool arguments: ${toolCall.function.arguments}`, { error: e });
          }
          
          // Process the tool call
          const toolRequest = await this.preToolCall(toolCall.id, {
            params: {
              name: toolName,
              arguments: toolArgs,
            },
          });
          
          if (toolRequest === false) {
            logger.warning(`Tool call ${toolName} was rejected by preToolCall`);
            continue;
          }
          
          // Call the tool
          try {
            const toolResult = await this.agent.callTool(
              toolRequest.params.name,
              toolRequest.params.arguments
            );
            
            // Process the tool result
            await this.postToolCall(toolCall.id, toolRequest, toolResult);
          } catch (error) {
            logger.error(`Error calling tool ${toolName}`, { error });
          }
        }
      }

      // Store the completion message for next iteration
      if (!this._previousMessages) {
        this._previousMessages = [];
      }
      
      this._previousMessages.push(assistantMessage);
      
      logger.debug(`Agent: ${agentName}, response:`, { data: response });
      
      // Update the agent name for the next iteration
      agentName = this.agent ? this.agent.name : null;
      
      iterations++;
    }

    // Return final response
    return response || '';
  }

  /**
   * Get request parameters
   * 
   * @param requestParams - Request parameters
   * @param defaultParams - Default parameters
   * @returns The request parameters
   */
  private getRequestParams(
    requestParams?: RequestParams,
    defaultParams?: Record<string, any>
  ): RequestParams {
    return {
      model: (requestParams?.model || defaultParams?.model || this.model),
      maxTokens: (requestParams?.maxTokens || defaultParams?.maxTokens || 8192),
      temperature: (requestParams?.temperature || defaultParams?.temperature || 0.7),
      parallelToolCalls: (requestParams?.parallelToolCalls ?? defaultParams?.parallelToolCalls ?? false),
      maxIterations: (requestParams?.maxIterations || defaultParams?.maxIterations || 10),
    };
  }

  /**
   * Get tools for the agent
   * 
   * @returns The tools
   */
  private async getTools(): Promise<any[]> {
    if (!this.agent) {
      return [];
    }
    
    const toolResult = await this.agent.listTools();
    
    return toolResult.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {},
      },
    }));
  }

  // Track previous messages for continuity in the conversation
  private _previousMessages: Message[] = [];
}
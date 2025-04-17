/**
 * Parallel LLM implementation for MCP Agent
 * 
 * This LLM distributes a task to multiple agents in parallel and then
 * aggregates the results.
 */
import { Agent } from '../../agents/agent';
import { AugmentedLLM, Message, CompletionOptions, CompletionResult } from '../llm/augmented_llm';
import { FanOut } from './fan_out';
import { FanIn } from './fan_in';
import { getLogger } from '../../logging/logger';

const logger = getLogger('parallel_llm');

/**
 * Parallel LLM implementation
 */
export class ParallelLLM extends AugmentedLLM {
  private fanOutAgents: Agent[];
  private fanInAgent: Agent;
  private llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  
  /**
   * Create a new parallel LLM
   * 
   * @param options - Parallel LLM options
   * @param options.fanOutAgents - List of agents to fan out to
   * @param options.fanInAgent - Agent to use for aggregation
   * @param options.llmFactory - Factory function to create an LLM for each agent
   * @param options.model - Model to use (passed to parent)
   * @param options.apiKey - API key to use (passed to parent)
   * @param options.baseUrl - Base URL to use (passed to parent)
   * @param options.options - Additional options (passed to parent)
   */
  constructor(options: {
    fanOutAgents: Agent[];
    fanInAgent: Agent;
    llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    super({
      agent: options.fanInAgent, // Use the fan-in agent as the main agent
      model: options.model || 'parallel',
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      options: options.options,
    });
    
    this.fanOutAgents = options.fanOutAgents;
    this.fanInAgent = options.fanInAgent;
    this.llmFactory = options.llmFactory;
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
    logger.debug('Executing parallel LLM', { 
      messageCount: messages.length,
      agentCount: this.fanOutAgents.length,
    });
    
    try {
      // Create fan-out and fan-in components
      const fanOut = new FanOut({
        agents: this.fanOutAgents,
        llmFactory: this.llmFactory,
      });
      
      const fanIn = new FanIn({
        agent: this.fanInAgent,
        llmFactory: this.llmFactory,
      });
      
      // Execute fan-out
      const fanOutResults = await fanOut.execute(messages, options);
      
      // Execute fan-in
      const result = await fanIn.execute(messages, fanOutResults, options);
      
      // Return the result
      return {
        id: `parallel-${Date.now()}`,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: result,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0, // Not tracked
          completion_tokens: 0, // Not tracked
          total_tokens: 0, // Not tracked
        },
      };
    } catch (error) {
      logger.error('Error in parallel LLM', { error });
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
    // For simplicity, we'll just use the regular complete method
    // In a real implementation, you might want to handle tool calls differently
    return this.complete(messages, options);
  }
}

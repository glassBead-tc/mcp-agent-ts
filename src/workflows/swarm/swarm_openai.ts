/**
 * OpenAI implementation of Swarm
 * 
 * MCP version of the OpenAI Swarm class, using OpenAI's ChatCompletion as the LLM
 */
import { OpenAIAugmentedLLM } from '../llm/augmented_llm_openai.js';
import { Message, CompletionOptions } from '../llm/augmented_llm.js';
import { Swarm, SwarmAgent } from './swarm.js';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('swarm_openai');

/**
 * OpenAI implementation of Swarm
 */
export class OpenAISwarm extends Swarm {
  /**
   * Initialize the OpenAI Swarm
   * 
   * @param options - Options for the swarm
   * @param options.agent - The agent to use as the starting point
   * @param options.contextVariables - Initial context variables
   * @param options.model - The model to use (defaults to gpt-4o)
   */
  constructor(options: {
    agent: SwarmAgent;
    contextVariables?: Record<string, string>;
    model?: string;
  }) {
    super({
      agent: options.agent,
      contextVariables: options.contextVariables
    });
    
    // Override the model with OpenAI model
    (this as any).model = options.model || 'gpt-4o';
  }
  
  /**
   * Complete a conversation
   * 
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async complete(messages: Message[], options?: CompletionOptions): Promise<any> {
    const llm = new OpenAIAugmentedLLM({
      agent: this.agent,
      model: (this as any).model || 'gpt-4o'
    });
    
    const maxIterations = options?.maxIterations || 10;
    let iterations = 0;
    let response = null;
    let agentName = this.agent ? this.agent.name : undefined;
    
    while (iterations < maxIterations && this.shouldContinue()) {
      // Use the original message for the first iteration, then a continuation prompt
      const promptMessage = iterations === 0 
        ? messages 
        : [{ role: 'user', content: 'Please resolve my original request. If it has already been resolved then end turn' }];
      
      // Call the OpenAI LLM with our current agent
      response = await llm.complete(promptMessage, {
        ...options,
        maxIterations: 1 // Only do one iteration per LLM call
      });
      
      logger.debug(`Agent: ${agentName}, response:`, { response });
      agentName = this.agent ? this.agent.name : undefined;
      iterations++;
    }
    
    // Return final response back
    return response;
  }
  
  /**
   * Complete a conversation with tool calling
   * 
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async completeWithTools(messages: Message[], options?: CompletionOptions): Promise<any> {
    const llm = new OpenAIAugmentedLLM({
      agent: this.agent,
      model: (this as any).model || 'gpt-4o'
    });
    
    const maxIterations = options?.maxIterations || 10;
    let iterations = 0;
    let response = null;
    let agentName = this.agent ? this.agent.name : undefined;
    
    while (iterations < maxIterations && this.shouldContinue()) {
      // Use the original message for the first iteration, then a continuation prompt
      const promptMessage = iterations === 0 
        ? messages 
        : [{ role: 'user', content: 'Please resolve my original request. If it has already been resolved then end turn' }];
      
      // Call the OpenAI LLM with our current agent
      response = await llm.completeWithTools(promptMessage, {
        ...options,
        maxIterations: 1 // Only do one iteration per LLM call
      });
      
      logger.debug(`Agent: ${agentName}, response:`, { response });
      agentName = this.agent ? this.agent.name : undefined;
      iterations++;
    }
    
    // Return final response back
    return response;
  }
}
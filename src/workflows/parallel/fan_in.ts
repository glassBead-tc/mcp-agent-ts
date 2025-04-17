/**
 * Fan-in component for Parallel workflow
 * 
 * This component aggregates results from multiple agents into a single result.
 */
import { Agent } from '../../agents/agent';
import { AugmentedLLM, Message, CompletionOptions } from '../llm/augmented_llm';
import { FanOutResult } from './fan_out';
import { getLogger } from '../../logging/logger';

const logger = getLogger('fan_in');

/**
 * Fan-in component for parallel workflow
 */
export class FanIn {
  private agent: Agent;
  private llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  
  /**
   * Create a new fan-in component
   * 
   * @param options - Fan-in options
   * @param options.agent - The agent to use for aggregation
   * @param options.llmFactory - Factory function to create an LLM for the agent
   */
  constructor(options: {
    agent: Agent;
    llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  }) {
    this.agent = options.agent;
    this.llmFactory = options.llmFactory;
  }
  
  /**
   * Generate a prompt for the fan-in agent
   * 
   * @param originalInput - The original input that was sent to all agents
   * @param results - The results from all agents
   * @returns The prompt for the fan-in agent
   */
  private generatePrompt(
    originalInput: string | Message[],
    results: FanOutResult[]
  ): string {
    const originalInputStr = typeof originalInput === 'string'
      ? originalInput
      : originalInput.filter(m => m.role === 'user').map(m => m.content).join('\n');
    
    let prompt = `Original request: ${originalInputStr}\n\n`;
    prompt += 'Results from agents:\n\n';
    
    for (const result of results) {
      prompt += `Agent: ${result.agent.name}\n`;
      prompt += `Result: ${result.result}\n\n`;
    }
    
    prompt += 'Please synthesize these results into a comprehensive response.';
    
    return prompt;
  }
  
  /**
   * Execute the fan-in operation
   * 
   * @param originalInput - The original input that was sent to all agents
   * @param results - The results from all agents
   * @param options - Completion options
   * @returns The aggregated result
   */
  async execute(
    originalInput: string | Message[],
    results: FanOutResult[],
    options?: CompletionOptions
  ): Promise<string> {
    logger.debug('Executing fan-in', { resultCount: results.length });
    
    try {
      // Initialize agent if not already initialized
      if (!this.agent.initialized) {
        await this.agent.initialize();
      }
      
      // Create LLM for this agent
      const llm = await this.llmFactory(this.agent);
      
      // Generate prompt
      const prompt = this.generatePrompt(originalInput, results);
      
      // Run the conversation
      const result = await llm.complete([
        { role: 'user', content: prompt }
      ], options);
      
      // Extract the result
      return result.choices[0].message.content;
    } catch (error) {
      logger.error('Error in fan-in', { error });
      throw error;
    }
  }
}

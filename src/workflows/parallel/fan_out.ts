/**
 * Fan-out component for Parallel workflow
 * 
 * This component distributes a task to multiple agents or LLMs in parallel.
 */
import { Agent } from '../../agents/agent.js';
import { AugmentedLLM, Message, CompletionOptions } from '../llm/augmented_llm.js';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('fan_out');

/**
 * Result of a fan-out operation
 */
export interface FanOutResult {
  /** The agent that produced this result */
  agent: Agent;
  /** The result of the agent's work */
  result: string;
  /** The full conversation with the agent */
  messages: Message[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Fan-out component for parallel workflow
 */
export class FanOut {
  private agents: Agent[];
  private llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  
  /**
   * Create a new fan-out component
   * 
   * @param options - Fan-out options
   * @param options.agents - List of agents to fan out to
   * @param options.llmFactory - Factory function to create an LLM for each agent
   */
  constructor(options: {
    agents: Agent[];
    llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  }) {
    this.agents = options.agents;
    this.llmFactory = options.llmFactory;
  }
  
  /**
   * Execute the fan-out operation
   * 
   * @param input - The input to send to all agents
   * @param options - Completion options
   * @returns Array of results from all agents
   */
  async execute(
    input: string | Message[],
    options?: CompletionOptions
  ): Promise<FanOutResult[]> {
    logger.debug('Executing fan-out', { agentCount: this.agents.length });
    
    // Convert input to messages if it's a string
    const messages: Message[] = typeof input === 'string'
      ? [{ role: 'user', content: input }]
      : input;
    
    // Create promises for all agents
    const promises = this.agents.map(async (agent) => {
      try {
        // Initialize agent if not already initialized
        if (!agent.initialized) {
          await agent.initialize();
        }
        
        // Create LLM for this agent
        const llm = await this.llmFactory(agent);
        
        // Run the conversation
        const resultMessages = await llm.runConversation(messages, options);
        
        // Extract the result (last assistant message)
        const assistantMessages = resultMessages.filter(m => m.role === 'assistant');
        const result = assistantMessages.length > 0
          ? assistantMessages[assistantMessages.length - 1].content
          : '';
        
        return {
          agent,
          result,
          messages: resultMessages,
        };
      } catch (error) {
        logger.error(`Error in fan-out for agent ${agent.name}`, { error });
        
        return {
          agent,
          result: `Error: ${error instanceof Error ? error.message : String(error)}`,
          messages,
          metadata: { error: true },
        };
      }
    });
    
    // Execute all promises in parallel
    return Promise.all(promises);
  }
}

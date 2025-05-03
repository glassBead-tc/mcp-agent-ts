/**
 * Evaluator-Optimizer workflow for MCP Agent
 * 
 * This workflow generates a response, evaluates its quality, and refines it iteratively
 * until it meets a quality threshold.
 */
import { Agent } from '../../agents/agent';
import { AugmentedLLM, Message, CompletionOptions } from '../llm/augmented_llm';
import { getLogger } from '../../logging/logger';

const logger = getLogger('evaluator_optimizer');

/**
 * Quality ratings for the evaluator
 */
export enum QualityRating {
  POOR = 0,
  FAIR = 1,
  GOOD = 2,
  EXCELLENT = 3,
}

/**
 * Map string ratings to enum values
 */
const RATING_MAP: Record<string, QualityRating> = {
  'POOR': QualityRating.POOR,
  'FAIR': QualityRating.FAIR,
  'GOOD': QualityRating.GOOD,
  'EXCELLENT': QualityRating.EXCELLENT,
};

/**
 * Result of the evaluation
 */
export interface EvaluationResult {
  rating: QualityRating;
  feedback: string;
  iterations: number;
}

/**
 * Evaluator-Optimizer LLM
 */
export class EvaluatorOptimizerLLM extends AugmentedLLM {
  private optimizer: Agent;
  private evaluator: Agent;
  private llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  private minRating: QualityRating;
  private maxIterations: number;
  
  /**
   * Create a new evaluator-optimizer LLM
   * 
   * @param options - Evaluator-optimizer options
   * @param options.optimizer - The agent that generates the initial response and optimizations
   * @param options.evaluator - The agent that evaluates the responses
   * @param options.llmFactory - Factory function to create an LLM for each agent
   * @param options.minRating - Minimum quality rating to accept (defaults to GOOD)
   * @param options.maxIterations - Maximum number of iterations (defaults to 5)
   * @param options.model - Model to use (passed to parent)
   * @param options.apiKey - API key to use (passed to parent)
   * @param options.baseUrl - Base URL to use (passed to parent)
   * @param options.options - Additional options (passed to parent)
   */
  constructor(options: {
    optimizer: Agent;
    evaluator: Agent;
    llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
    minRating?: QualityRating;
    maxIterations?: number;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    super({
      agent: options.optimizer, // Use the optimizer as the main agent
      model: options.model || 'evaluator-optimizer',
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      options: options.options,
    });
    
    this.optimizer = options.optimizer;
    this.evaluator = options.evaluator;
    this.llmFactory = options.llmFactory;
    this.minRating = options.minRating !== undefined ? options.minRating : QualityRating.GOOD;
    this.maxIterations = options.maxIterations || 5;
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
  ): Promise<any> {
    logger.debug('Running evaluator-optimizer workflow', { 
      messageCount: messages.length, 
      minRating: this.minRating,
      maxIterations: this.maxIterations,
    });
    
    try {
      // Initialize agents
      await Promise.all([
        this.optimizer.initialized || this.optimizer.initialize(),
        this.evaluator.initialized || this.evaluator.initialize(),
      ]);
      
      // Create LLMs for each agent
      const optimizerLLM = await this.llmFactory(this.optimizer);
      const evaluatorLLM = await this.llmFactory(this.evaluator);
      
      // Extract the user message
      const userMessage = messages.find(m => m.role === 'user')?.content || '';
      
      let currentResponse = '';
      let currentRating = QualityRating.POOR;
      let feedback = '';
      let iterations = 0;
      
      // Generate initial response
      const initialResponse = await optimizerLLM.runConversation([
        { role: 'user', content: userMessage }
      ], options);
      
      currentResponse = initialResponse.find(m => m.role === 'assistant')?.content || '';
      
      // Iteratively improve until quality threshold or max iterations reached
      while (currentRating < this.minRating && iterations < this.maxIterations) {
        iterations++;
        
        // Evaluate current response
        const evaluationPrompt = `Evaluate the following response:
        
ORIGINAL REQUEST: ${userMessage}

CURRENT RESPONSE:
${currentResponse}

${iterations > 1 ? `PREVIOUS FEEDBACK:
${feedback}` : ''}

Evaluate this response using the rating system (POOR, FAIR, GOOD, EXCELLENT) and provide detailed feedback for improvement.`;
        
        const evaluationResult = await evaluatorLLM.runConversation([
          { role: 'user', content: evaluationPrompt }
        ], {
          ...options,
          temperature: 0.2, // Lower temperature for more consistent evaluations
        });
        
        const evaluationResponse = evaluationResult.find(m => m.role === 'assistant')?.content || '';
        
        // Extract rating from response
        const ratingMatch = evaluationResponse.match(/overall.*(EXCELLENT|GOOD|FAIR|POOR)/i);
        const extractedRating = ratingMatch 
          ? ratingMatch[1].toUpperCase() 
          : (evaluationResponse.includes('EXCELLENT') ? 'EXCELLENT' : 
             evaluationResponse.includes('GOOD') ? 'GOOD' : 
             evaluationResponse.includes('FAIR') ? 'FAIR' : 'POOR');
        
        currentRating = RATING_MAP[extractedRating] || QualityRating.POOR;
        feedback = evaluationResponse;
        
        logger.debug(`Iteration ${iterations}: Rating=${extractedRating}`, { currentRating });
        
        // If rating is already good enough, we're done
        if (currentRating >= this.minRating) {
          break;
        }
        
        // Otherwise, optimize the response
        const optimizationPrompt = `Revise the following response based on the feedback:
        
ORIGINAL REQUEST: ${userMessage}

CURRENT RESPONSE:
${currentResponse}

EVALUATION AND FEEDBACK:
${feedback}

Please provide a revised and improved response that addresses the feedback.`;
        
        const optimizationResult = await optimizerLLM.runConversation([
          { role: 'user', content: optimizationPrompt }
        ], options);
        
        currentResponse = optimizationResult.find(m => m.role === 'assistant')?.content || '';
      }
      
      // Return the final response
      return {
        id: `evaluator-optimizer-${Date.now()}`,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: currentResponse,
            },
            finish_reason: 'stop',
          },
        ],
        evaluation: {
          rating: currentRating,
          feedback,
          iterations,
        },
      };
    } catch (error) {
      logger.error('Error in evaluator-optimizer workflow', { error });
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
  ): Promise<any> {
    // For simplicity, we'll just use the regular complete method
    // In a real implementation, you might want to handle tool calls differently
    return this.complete(messages, options);
  }
}
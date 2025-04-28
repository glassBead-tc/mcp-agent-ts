/**
 * Implementation of the evaluator-optimizer workflow
 * 
 * This workflow uses one LLM to generate responses and another to evaluate
 * and provide feedback in a refinement loop.
 */
import { Agent } from '../../agents/agent';
import { Context } from '../../context';
import { AugmentedLLM, Message, CompletionOptions } from '../llm/augmented_llm';
import { getLogger } from '../../logging/logger';

const logger = getLogger('evaluator_optimizer');

/**
 * Enum for evaluation quality ratings
 */
export enum QualityRating {
  POOR = 0,      // Major improvements needed
  FAIR = 1,      // Several improvements needed
  GOOD = 2,      // Minor improvements possible
  EXCELLENT = 3  // No improvements needed
}

/**
 * Model representing the evaluation result from the evaluator LLM
 */
export interface EvaluationResult {
  /**
   * Quality rating of the response
   */
  rating: QualityRating;
  
  /**
   * Specific feedback and suggestions for improvement
   */
  feedback: string;
  
  /**
   * Whether the output needs further improvement
   */
  needs_improvement: boolean;
  
  /**
   * Specific areas to focus on in next iteration
   */
  focus_areas: string[];
}

/**
 * Type for LLM factory function
 */
type LLMFactory = (agent: Agent) => Promise<AugmentedLLM>;

/**
 * Implementation of the evaluator-optimizer workflow where one LLM generates responses
 * while another provides evaluation and feedback in a refinement loop.
 * 
 * This can be used either:
 * 1. As a standalone workflow with its own optimizer agent
 * 2. As a wrapper around another workflow (Orchestrator, Router, ParallelLLM) to add
 *    evaluation and refinement capabilities
 */
export class EvaluatorOptimizerLLM extends AugmentedLLM {
  private optimizer: Agent | AugmentedLLM;
  private evaluator: Agent | AugmentedLLM | string;
  private llmFactory?: LLMFactory;
  private optimizerLLM: AugmentedLLM;
  private evaluatorLLM: AugmentedLLM;
  private minRating: QualityRating;
  private maxRefinements: number;
  private refinementHistory: Array<{
    attempt: number;
    response: any;
    evaluation_result: EvaluationResult;
  }> = [];
  
  /**
   * Initialize the evaluator-optimizer workflow
   * 
   * @param options - Options for the workflow
   * @param options.optimizer - The agent/LLM that generates responses
   * @param options.evaluator - The agent/LLM/criteria that evaluates responses
   * @param options.minRating - Minimum acceptable quality rating
   * @param options.maxRefinements - Maximum refinement iterations
   * @param options.llmFactory - Factory to create LLMs from agents
   * @param options.context - Optional context to use
   */
  constructor(options: {
    optimizer: Agent | AugmentedLLM;
    evaluator: Agent | AugmentedLLM | string;
    minRating?: QualityRating;
    maxRefinements?: number;
    llmFactory?: LLMFactory;
    context?: Context;
  }) {
    super({
      agent: options.optimizer instanceof Agent 
        ? options.optimizer 
        : options.optimizer.agent,
      model: options.optimizer instanceof AugmentedLLM
        ? options.optimizer.model
        : undefined
    });
    
    this.optimizer = options.optimizer;
    this.evaluator = options.evaluator;
    this.llmFactory = options.llmFactory;
    this.minRating = options.minRating || QualityRating.GOOD;
    this.maxRefinements = options.maxRefinements || 3;
    
    // Set up the optimizer
    if (this.optimizer instanceof Agent) {
      if (!this.llmFactory) {
        throw new Error("llmFactory is required when using an Agent");
      }
      
      // Note: In TS we can't immediately set this here as it's async,
      // so we need to handle initialization in the generate method
      this.optimizerLLM = null as unknown as AugmentedLLM;
      this.aggregator = this.optimizer;
      this.instruction = typeof this.optimizer.instruction === 'string'
        ? this.optimizer.instruction
        : undefined;
        
    } else if (this.optimizer instanceof AugmentedLLM) {
      this.optimizerLLM = this.optimizer;
      this.aggregator = this.optimizer.agent;
      this.instruction = this.optimizer.instruction;
      
    } else {
      throw new Error(`Unsupported optimizer type: ${typeof this.optimizer}`);
    }
    
    // The evaluatorLLM will be initialized in the generate method
    this.evaluatorLLM = null as unknown as AugmentedLLM;
  }
  
  /**
   * Initialize the LLMs if they aren't already initialized
   */
  private async ensureInitialized(): Promise<void> {
    // Initialize optimizer LLM if needed
    if (this.optimizer instanceof Agent && !this.optimizerLLM) {
      if (!this.llmFactory) {
        throw new Error("llmFactory is required when using an Agent");
      }
      this.optimizerLLM = await this.llmFactory(this.optimizer);
    }
    
    // Initialize evaluator LLM if needed
    if (!this.evaluatorLLM) {
      if (this.evaluator instanceof AugmentedLLM) {
        this.evaluatorLLM = this.evaluator;
        
      } else if (this.evaluator instanceof Agent) {
        if (!this.llmFactory) {
          throw new Error("llmFactory is required when using an Agent evaluator");
        }
        this.evaluatorLLM = await this.llmFactory(this.evaluator);
        
      } else if (typeof this.evaluator === 'string') {
        if (!this.llmFactory) {
          throw new Error("llmFactory is required when using a string evaluator");
        }
        
        const evaluatorAgent = new Agent({
          name: "Evaluator",
          instruction: this.evaluator
        });
        
        this.evaluatorLLM = await this.llmFactory(evaluatorAgent);
        
      } else {
        throw new Error(`Unsupported evaluator type: ${typeof this.evaluator}`);
      }
    }
  }
  
  /**
   * Generate an optimized response through evaluation-guided refinement
   * 
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<any> {
    await this.ensureInitialized();
    
    let refinementCount = 0;
    let response: any = null;
    let bestResponse: any = null;
    let bestRating = QualityRating.POOR;
    this.refinementHistory = [];
    
    // Extract the message content for prompting
    const userMessage = messages.filter(m => m.role === 'user').pop();
    const messageContent = userMessage ? userMessage.content : '';
    
    // Initial generation
    response = await this.optimizerLLM.complete(messages, options);
    bestResponse = response;
    
    const extractResponseText = (resp: any): string => {
      if (!resp) return '';
      if (resp.choices && resp.choices.length > 0 && resp.choices[0].message) {
        return resp.choices[0].message.content || '';
      }
      return JSON.stringify(resp);
    };
    
    while (refinementCount < this.maxRefinements) {
      logger.debug('Optimizer result:', { response });
      
      // Evaluate current response
      const evalPrompt = this.buildEvalPrompt(
        messageContent,
        extractResponseText(response),
        refinementCount
      );
      
      const evalMessages: Message[] = [
        { role: 'user', content: evalPrompt }
      ];
      
      const evalResponse = await this.evaluatorLLM.complete(evalMessages, {
        ...options,
        responseFormat: { type: 'json_object' }
      });
      
      // Extract the evaluation result
      let evaluationResult: EvaluationResult;
      try {
        const evalContent = extractResponseText(evalResponse);
        evaluationResult = JSON.parse(evalContent) as EvaluationResult;
      } catch (error) {
        logger.error('Failed to parse evaluation result', { error });
        // Create a default evaluation result
        evaluationResult = {
          rating: QualityRating.POOR,
          feedback: 'Failed to parse evaluation',
          needs_improvement: true,
          focus_areas: ['parsing']
        };
      }
      
      // Track iteration
      this.refinementHistory.push({
        attempt: refinementCount + 1,
        response,
        evaluation_result: evaluationResult
      });
      
      logger.debug('Evaluator result:', { evaluationResult });
      
      // Track best response
      if (evaluationResult.rating > bestRating) {
        bestRating = evaluationResult.rating;
        bestResponse = response;
        logger.debug('New best response:', { rating: bestRating, response: bestResponse });
      }
      
      // Check if we've reached acceptable quality
      if (evaluationResult.rating >= this.minRating || !evaluationResult.needs_improvement) {
        logger.debug(`Acceptable quality ${evaluationResult.rating} reached`, {
          rating: evaluationResult.rating,
          needs_improvement: evaluationResult.needs_improvement,
          minRating: this.minRating
        });
        break;
      }
      
      // Generate refined response
      const refinementPrompt = this.buildRefinementPrompt(
        messageContent,
        extractResponseText(response),
        evaluationResult,
        refinementCount
      );
      
      const refinementMessages: Message[] = [
        { role: 'user', content: refinementPrompt }
      ];
      
      response = await this.optimizerLLM.complete(refinementMessages, options);
      refinementCount++;
    }
    
    return bestResponse;
  }
  
  /**
   * Complete a conversation with tool calling
   * 
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result with possible tool calls
   */
  async completeWithTools(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<any> {
    // For now, we'll just use the regular complete method
    // In a full implementation, we'd need to handle tool calls in the refinement loop
    return this.complete(messages, options);
  }
  
  /**
   * Build the evaluation prompt for the evaluator
   * 
   * @param originalRequest - The original user request
   * @param currentResponse - The current response to evaluate
   * @param iteration - The current iteration number
   * @returns The evaluation prompt
   */
  private buildEvalPrompt(
    originalRequest: string,
    currentResponse: string,
    iteration: number
  ): string {
    // This assumes that evaluator is either a string (the instruction) or has an instruction property
    const instructionText = typeof this.evaluator === 'string' 
      ? this.evaluator
      : (this.evaluator as any).instruction || 'Evaluate the response based on quality, accuracy, and helpfulness.';
    
    return `
      Evaluate the following response based on these criteria:
      ${instructionText}

      Original Request: ${originalRequest}
      Current Response (Iteration ${iteration + 1}): ${currentResponse}

      Provide your evaluation as a structured JSON response with:
      1. A quality rating (0=POOR, 1=FAIR, 2=GOOD, or 3=EXCELLENT)
      2. Specific feedback and suggestions
      3. Whether improvement is needed (true/false)
      4. Focus areas for improvement

      Rate as EXCELLENT (3) only if no improvements are needed.
      Rate as GOOD (2) if only minor improvements are possible.
      Rate as FAIR (1) if several improvements are needed.
      Rate as POOR (0) if major improvements are needed.
    `;
  }
  
  /**
   * Build the refinement prompt for the optimizer
   * 
   * @param originalRequest - The original user request
   * @param currentResponse - The current response to refine
   * @param feedback - The evaluation feedback
   * @param iteration - The current iteration number
   * @returns The refinement prompt
   */
  private buildRefinementPrompt(
    originalRequest: string,
    currentResponse: string,
    feedback: EvaluationResult,
    iteration: number
  ): string {
    return `
      Improve your previous response based on the evaluation feedback.
      
      Original Request: ${originalRequest}
      
      Previous Response (Iteration ${iteration + 1}): 
      ${currentResponse}
      
      Quality Rating: ${feedback.rating === 0 ? 'POOR' : 
        feedback.rating === 1 ? 'FAIR' : 
        feedback.rating === 2 ? 'GOOD' : 'EXCELLENT'}
      Feedback: ${feedback.feedback}
      Areas to Focus On: ${feedback.focus_areas.join(', ')}
      
      Generate an improved version addressing the feedback while maintaining accuracy and relevance.
    `;
  }
}
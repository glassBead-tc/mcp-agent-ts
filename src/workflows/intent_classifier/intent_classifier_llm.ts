/**
 * LLM-based intent classifier
 */
import { AugmentedLLM } from '../llm/augmented_llm.js';
import { Intent, IntentClassifier, IntentClassificationResult } from './intent_classifier_base.js';
import { Context } from '../../context.js';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('intent_classifier_llm');

/**
 * Default instruction template for intent classification
 */
const DEFAULT_INTENT_CLASSIFICATION_INSTRUCTION = `
You are a precise intent classifier that analyzes user requests to determine their intended action or purpose.
Below are the available intents with their descriptions and examples:

{context}

Your task is to analyze the following request and determine the most likely intent(s). Consider:
- How well the request matches the intent descriptions and examples
- Any specific entities or parameters that should be extracted
- The confidence level in the classification

Request: {request}

Respond in JSON format:
{
    "classifications": [
        {
            "intent": <intent name>,
            "confidence": <float between 0 and 1>,
            "extracted_entities": {
                "entity_name": "entity_value"
            },
            "reasoning": <brief explanation>
        }
    ]
}

Return up to {top_k} most likely intents. Only include intents with reasonable confidence (>0.5).
If no intents match well, return an empty list.
`;

/**
 * Confidence level for LLM-based classification
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * LLM-specific intent classification result
 */
export interface LLMIntentClassificationResult extends IntentClassificationResult {
  /**
   * Confidence level of the classification
   */
  confidence?: ConfidenceLevel;
  
  /**
   * Optional explanation of why this intent was chosen
   */
  reasoning?: string;
}

/**
 * Complete structured response from the LLM
 */
export interface StructuredIntentResponse {
  /**
   * List of classification results
   */
  classifications: LLMIntentClassificationResult[];
}

/**
 * An intent classifier that uses an LLM to determine the user's intent.
 * 
 * Particularly useful when you need:
 * - Flexible understanding of natural language
 * - Detailed reasoning about classifications
 * - Entity extraction alongside classification
 */
export class LLMIntentClassifier extends IntentClassifier {
  private llm: AugmentedLLM;
  private classificationInstruction?: string;
  
  /**
   * Create a new LLM-based intent classifier
   * 
   * @param options - Options for the classifier
   * @param options.llm - The LLM to use for classification
   * @param options.intents - List of intents to classify against
   * @param options.classificationInstruction - Optional custom instruction for classification
   * @param options.context - Optional context to use
   */
  constructor(options: {
    llm: AugmentedLLM;
    intents: Intent[];
    classificationInstruction?: string;
    context?: Context;
  }) {
    super(options.intents, options.context);
    
    this.llm = options.llm;
    this.classificationInstruction = options.classificationInstruction;
  }
  
  /**
   * Factory method to create and initialize a classifier
   * 
   * @param options - Options for the classifier
   * @param options.llm - The LLM to use for classification
   * @param options.intents - List of intents to classify against
   * @param options.classificationInstruction - Optional custom instruction for classification
   * @returns A new initialized classifier
   */
  static async create(options: {
    llm: AugmentedLLM;
    intents: Intent[];
    classificationInstruction?: string;
  }): Promise<LLMIntentClassifier> {
    const instance = new LLMIntentClassifier(options);
    await instance.initialize();
    return instance;
  }
  
  /**
   * Classify the input request into one or more intents
   * 
   * @param request - The input text to classify
   * @param top_k - Maximum number of top intent matches to return
   * @returns List of classification results, ordered by confidence
   */
  async classify(request: string, top_k: number = 1): Promise<LLMIntentClassificationResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const classificationInstruction = this.classificationInstruction || DEFAULT_INTENT_CLASSIFICATION_INSTRUCTION;
    
    // Generate the context with intent descriptions and examples
    const context = this.generateContext();
    
    // Format the prompt with all the necessary information
    const prompt = classificationInstruction
      .replace('{context}', context)
      .replace('{request}', request)
      .replace('{top_k}', top_k.toString());
    
    try {
      // Get classification from LLM
      // Note: Using a simplified approach since we don't have the generate_structured method
      const response = await this.llm.generateStr(prompt);
      
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('Failed to extract JSON from LLM response', { response });
        return [];
      }
      
      const jsonStr = jsonMatch[0];
      const parsedResponse = JSON.parse(jsonStr) as StructuredIntentResponse;
      
      if (!parsedResponse || !parsedResponse.classifications) {
        return [];
      }
      
      const results: LLMIntentClassificationResult[] = [];
      for (const classification of parsedResponse.classifications) {
        const intent = this.intents[classification.intent];
        if (!intent) {
          // Skip invalid categories
          logger.warn(`Classification returned unknown intent: ${classification.intent}`);
          continue;
        }
        
        results.push(classification);
      }
      
      return results.slice(0, top_k);
    } catch (error) {
      logger.error('Error during LLM intent classification', { error });
      return [];
    }
  }
  
  /**
   * Generate a formatted context string describing all intents
   * 
   * @returns Formatted context string
   */
  private generateContext(): string {
    const contextParts: string[] = [];
    
    let idx = 1;
    for (const intent of Object.values(this.intents)) {
      let description = `${idx}. Intent: ${intent.name}\nDescription: ${intent.description || 'No description'}`;
      
      if (intent.examples && intent.examples.length > 0) {
        const examples = intent.examples.map(ex => `- ${ex}`).join('\n');
        description += `\nExamples:\n${examples}`;
      }
      
      if (intent.metadata && Object.keys(intent.metadata).length > 0) {
        const metadata = Object.entries(intent.metadata)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n');
        description += `\nAdditional Information:\n${metadata}`;
      }
      
      contextParts.push(description);
      idx++;
    }
    
    return contextParts.join('\n\n');
  }
}
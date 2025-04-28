/**
 * Base classes and interfaces for intent classification
 */
import { Context } from '../../context';
import { ContextDependent } from '../../context_dependent';

/**
 * A class that represents a single intent category
 */
export interface Intent {
  /**
   * The name of the intent
   */
  name: string;
  
  /**
   * A description of what this intent represents
   */
  description?: string;
  
  /**
   * Example phrases or requests that match this intent
   */
  examples?: string[];
  
  /**
   * Additional metadata about the intent that might be useful for classification
   */
  metadata?: Record<string, string>;
}

/**
 * A class that represents the result of intent classification
 */
export interface IntentClassificationResult {
  /**
   * The classified intent name
   */
  intent: string;
  
  /**
   * The probability score (i.e. 0->1) of the classification
   * This is optional and may only be provided if the classifier is probabilistic
   */
  p_score?: number;
  
  /**
   * Any entities or parameters extracted from the input request that are relevant to the intent
   */
  extracted_entities?: Record<string, string>;
}

/**
 * Base class for intent classification
 * 
 * This can be implemented using different approaches like LLMs, embedding models,
 * traditional ML classification models, or rule-based systems.
 */
export abstract class IntentClassifier extends ContextDependent {
  protected intents: Record<string, Intent>;
  protected initialized: boolean;
  
  /**
   * Create a new intent classifier
   * 
   * @param intents - List of intents to classify against
   * @param context - Optional context to use
   */
  constructor(intents: Intent[], context?: Context) {
    super(context);
    
    this.intents = intents.reduce((acc, intent) => {
      acc[intent.name] = intent;
      return acc;
    }, {} as Record<string, Intent>);
    
    this.initialized = false;
    
    if (Object.keys(this.intents).length === 0) {
      throw new Error("At least one intent must be provided");
    }
  }
  
  /**
   * Classify the input request into one or more intents
   * 
   * @param request - The input text to classify
   * @param top_k - Maximum number of top intent matches to return
   * @returns List of classification results, ordered by confidence
   */
  abstract classify(request: string, top_k?: number): Promise<IntentClassificationResult[]>;
  
  /**
   * Initialize the classifier
   * Override this method if needed
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }
}
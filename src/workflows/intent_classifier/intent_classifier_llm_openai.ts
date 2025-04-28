/**
 * OpenAI implementation of LLM-based intent classifier
 */
import { OpenAIAugmentedLLM } from '../llm/augmented_llm_openai.js';
import { LLMIntentClassifier } from './intent_classifier_llm.js';
import { Intent } from './intent_classifier_base.js';
import { Agent } from '../../agents/agent.js';
import { Context } from '../../context.js';

/**
 * An intent classifier that uses OpenAI models for classification
 */
export class OpenAIIntentClassifier extends LLMIntentClassifier {
  /**
   * Create a new OpenAI intent classifier
   * 
   * @param options - Options for the classifier
   * @param options.agent - The agent to use
   * @param options.intents - List of intents to classify against
   * @param options.model - The model to use (defaults to gpt-4o)
   * @param options.classificationInstruction - Optional custom instruction for classification
   * @param options.context - Optional context to use
   */
  constructor(options: {
    agent: Agent;
    intents: Intent[];
    model?: string;
    classificationInstruction?: string;
    context?: Context;
  }) {
    const llm = new OpenAIAugmentedLLM({
      agent: options.agent,
      model: options.model || 'gpt-4o'
    });
    
    super({
      llm,
      intents: options.intents,
      classificationInstruction: options.classificationInstruction,
      context: options.context
    });
  }
  
  /**
   * Factory method to create and initialize a classifier
   * 
   * @param options - Options for the classifier
   * @param options.agent - The agent to use
   * @param options.intents - List of intents to classify against
   * @param options.model - The model to use
   * @param options.classificationInstruction - Optional custom instruction for classification
   * @returns A new initialized classifier
   */
  static async create(options: {
    agent: Agent;
    intents: Intent[];
    model?: string;
    classificationInstruction?: string;
  }): Promise<OpenAIIntentClassifier> {
    const instance = new OpenAIIntentClassifier(options);
    await instance.initialize();
    return instance;
  }
}
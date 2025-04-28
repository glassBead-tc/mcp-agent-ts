/**
 * Anthropic implementation of LLM-based intent classifier
 */
import { AnthropicAugmentedLLM } from '../llm/augmented_llm_anthropic.js';
import { LLMIntentClassifier } from './intent_classifier_llm.js';
import { Intent } from './intent_classifier_base.js';
import { Agent } from '../../agents/agent.js';
import { Context } from '../../context.js';

/**
 * An intent classifier that uses Anthropic models for classification
 */
export class AnthropicIntentClassifier extends LLMIntentClassifier {
  /**
   * Create a new Anthropic intent classifier
   * 
   * @param options - Options for the classifier
   * @param options.agent - The agent to use
   * @param options.intents - List of intents to classify against
   * @param options.model - The model to use (defaults to claude-3-opus-20240229)
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
    const llm = new AnthropicAugmentedLLM({
      agent: options.agent,
      model: options.model || 'claude-3-opus-20240229'
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
  }): Promise<AnthropicIntentClassifier> {
    const instance = new AnthropicIntentClassifier(options);
    await instance.initialize();
    return instance;
  }
}
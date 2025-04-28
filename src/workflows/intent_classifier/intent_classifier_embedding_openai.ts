/**
 * OpenAI implementation of embedding-based intent classifier
 */
import { OpenAIEmbeddingModel } from '../embedding/embedding_openai.js';
import { EmbeddingIntentClassifier } from './intent_classifier_embedding.js';
import { Intent } from './intent_classifier_base.js';
import { Context } from '../../context.js';

/**
 * An intent classifier that uses OpenAI embeddings for classification
 */
export class OpenAIEmbeddingIntentClassifier extends EmbeddingIntentClassifier {
  /**
   * Create a new OpenAI embedding-based intent classifier
   * 
   * @param options - Options for the classifier
   * @param options.intents - List of intents to classify against
   * @param options.model - The embedding model to use (defaults to text-embedding-3-small)
   * @param options.context - Optional context to use
   */
  constructor(options: {
    intents: Intent[];
    model?: string;
    context?: Context;
  }) {
    const embeddingModel = new OpenAIEmbeddingModel({
      model: options.model || 'text-embedding-3-small',
      context: options.context
    });
    
    super({
      intents: options.intents,
      embeddingModel,
      context: options.context
    });
  }
  
  /**
   * Factory method to create and initialize a classifier
   * 
   * @param options - Options for the classifier
   * @param options.intents - List of intents to classify against
   * @param options.model - The embedding model to use
   * @returns A new initialized classifier
   */
  static async create(options: {
    intents: Intent[];
    model?: string;
  }): Promise<OpenAIEmbeddingIntentClassifier> {
    const instance = new OpenAIEmbeddingIntentClassifier(options);
    await instance.initialize();
    return instance;
  }
}
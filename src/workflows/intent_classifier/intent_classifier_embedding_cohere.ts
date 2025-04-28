/**
 * Cohere implementation of embedding-based intent classifier
 */
import { CohereEmbeddingModel } from '../embedding/embedding_cohere';
import { EmbeddingIntentClassifier } from './intent_classifier_embedding';
import { Intent } from './intent_classifier_base';
import { Context } from '../../context';

/**
 * An intent classifier that uses Cohere embeddings for classification
 */
export class CohereEmbeddingIntentClassifier extends EmbeddingIntentClassifier {
  /**
   * Create a new Cohere embedding-based intent classifier
   * 
   * @param options - Options for the classifier
   * @param options.intents - List of intents to classify against
   * @param options.model - The embedding model to use (defaults to embed-multilingual-v3.0)
   * @param options.context - Optional context to use
   */
  constructor(options: {
    intents: Intent[];
    model?: string;
    context?: Context;
  }) {
    const embeddingModel = new CohereEmbeddingModel({
      model: options.model || 'embed-multilingual-v3.0',
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
  }): Promise<CohereEmbeddingIntentClassifier> {
    const instance = new CohereEmbeddingIntentClassifier(options);
    await instance.initialize();
    return instance;
  }
}
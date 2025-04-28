/**
 * Embedding-based intent classifier
 */
import { EmbeddingModel, computeConfidence, computeSimilarityScores } from '../embedding/embedding_base';
import { Intent, IntentClassifier, IntentClassificationResult } from './intent_classifier_base';
import { Context } from '../../context';
import { getLogger } from '../../logging/logger';

const logger = getLogger('intent_classifier_embedding');

/**
 * An intent with embedding information
 */
export interface EmbeddingIntent extends Intent {
  /**
   * Pre-computed embedding for this intent
   */
  embedding?: number[];
}

/**
 * An intent classifier that uses embedding similarity for classification.
 * 
 * Supports different embedding models through the EmbeddingModel interface.
 * 
 * Features:
 * - Semantic similarity based classification
 * - Support for example-based learning
 * - Flexible embedding model support
 * - Multiple similarity computation strategies
 */
export class EmbeddingIntentClassifier extends IntentClassifier {
  private embeddingModel: EmbeddingModel;
  
  /**
   * Create a new embedding-based intent classifier
   * 
   * @param options - Options for the classifier
   * @param options.intents - List of intents to classify against
   * @param options.embeddingModel - The embedding model to use
   * @param options.context - Optional context to use
   */
  constructor(options: {
    intents: Intent[];
    embeddingModel: EmbeddingModel;
    context?: Context;
  }) {
    super(options.intents, options.context);
    
    this.embeddingModel = options.embeddingModel;
  }
  
  /**
   * Factory method to create and initialize a classifier
   * 
   * @param options - Options for the classifier
   * @param options.intents - List of intents to classify against
   * @param options.embeddingModel - The embedding model to use
   * @returns A new initialized classifier
   */
  static async create(options: {
    intents: Intent[];
    embeddingModel: EmbeddingModel;
  }): Promise<EmbeddingIntentClassifier> {
    const instance = new EmbeddingIntentClassifier(options);
    await instance.initialize();
    return instance;
  }
  
  /**
   * Initialize the classifier by precomputing embeddings for all intents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    for (const intentName of Object.keys(this.intents)) {
      const intent = this.intents[intentName];
      
      // Combine all text for a rich intent representation
      const intentTexts = [
        intent.name,
        intent.description || '',
        ...(intent.examples || [])
      ].filter(text => text.length > 0);
      
      try {
        // Get embeddings for all texts
        const embeddings = await this.embeddingModel.embed(intentTexts);
        
        // Use mean pooling to combine embeddings (simplified for TypeScript)
        const embedding = this.meanPooling(embeddings);
        
        // Update intent with embedding
        this.intents[intentName] = {
          ...intent,
          embedding
        };
      } catch (error) {
        logger.error(`Error embedding intent ${intentName}`, { error });
      }
    }
    
    this.initialized = true;
  }
  
  /**
   * Classify the input request into one or more intents
   * 
   * @param request - The input text to classify
   * @param top_k - Maximum number of top intent matches to return
   * @returns List of classification results, ordered by confidence
   */
  async classify(request: string, top_k: number = 1): Promise<IntentClassificationResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Get embedding for input
      const embeddings = await this.embeddingModel.embed([request]);
      const requestEmbedding = embeddings[0]; // Take first since we only embedded one text
      
      const results: IntentClassificationResult[] = [];
      
      for (const [intentName, intent] of Object.entries(this.intents)) {
        const embeddingIntent = intent as EmbeddingIntent;
        
        if (!embeddingIntent.embedding) {
          continue;
        }
        
        const similarityScores = computeSimilarityScores(
          requestEmbedding,
          embeddingIntent.embedding
        );
        
        // Compute overall confidence score
        const confidence = computeConfidence(similarityScores);
        
        results.push({
          intent: intentName,
          p_score: confidence
        });
      }
      
      // Sort by confidence (p_score) in descending order
      results.sort((a, b) => (b.p_score || 0) - (a.p_score || 0));
      
      return results.slice(0, top_k);
    } catch (error) {
      logger.error('Error during embedding intent classification', { error });
      return [];
    }
  }
  
  /**
   * Calculate the mean pooling of embeddings
   * 
   * @param embeddings - Array of embeddings to combine
   * @returns Mean-pooled embedding
   */
  private meanPooling(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return [];
    }
    
    const embeddingDim = embeddings[0].length;
    const result = new Array(embeddingDim).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < embeddingDim; i++) {
        result[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < embeddingDim; i++) {
      result[i] /= embeddings.length;
    }
    
    return result;
  }
}
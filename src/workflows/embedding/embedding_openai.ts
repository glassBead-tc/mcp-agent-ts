/**
 * OpenAI embedding model implementation
 */
import OpenAI from 'openai';
import { EmbeddingModel, FloatArray } from './embedding_base';
import { Context } from '../../context';
import { getLogger } from '../../logging/logger';

const logger = getLogger('embedding_openai');

/**
 * OpenAI embedding model implementation
 */
export class OpenAIEmbeddingModel extends EmbeddingModel {
  private client: OpenAI;
  private model: string;
  private _embeddingDim: number;
  
  /**
   * Create a new OpenAI embedding model
   * 
   * @param options - Options for the model
   * @param options.model - The model to use (defaults to text-embedding-3-small)
   * @param options.context - Optional context to use
   */
  constructor(options: {
    model?: string;
    context?: Context;
  } = {}) {
    super(options.context);
    
    this.model = options.model || 'text-embedding-3-small';
    
    // Initialize the client
    this.client = new OpenAI({
      apiKey: this.context.config.openai?.api_key,
      baseURL: this.context.config.openai?.base_url
    });
    
    // Cache the dimension since it's fixed per model
    const dimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };
    
    this._embeddingDim = dimensions[this.model] || 1536;
  }
  
  /**
   * Generate embeddings for a list of messages
   * 
   * @param data - List of text strings to embed
   * @returns Array of embeddings, shape (len(texts), embedding_dim)
   */
  async embed(data: string[]): Promise<FloatArray> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: data,
        encoding_format: 'float'
      });
      
      // Sort the embeddings by their index to ensure correct order
      const sortedEmbeddings = [...response.data].sort((a, b) => a.index - b.index);
      
      // Convert to the expected format
      const embeddings = sortedEmbeddings.map(item => item.embedding as number[]);
      
      return embeddings;
    } catch (error) {
      logger.error('Error generating OpenAI embeddings', { error });
      throw error;
    }
  }
  
  /**
   * Return the dimensionality of the embeddings
   */
  get embeddingDim(): number {
    return this._embeddingDim;
  }
}
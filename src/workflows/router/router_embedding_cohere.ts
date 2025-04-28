/**
 * Cohere embedding-based router for MCP Agent
 */
import { EmbeddingRouter, EmbeddingProvider } from './router_embedding.js';
import { Agent } from '../../agents/agent.js';
import { getLogger } from '../../logging/logger.js';
import { CohereEmbeddingModel } from '../embedding/embedding_cohere.js';

const logger = getLogger('router_embedding_cohere');

/**
 * Cohere embedding provider implementation
 */
class CohereEmbeddingProvider implements EmbeddingProvider {
  private embeddingModel: CohereEmbeddingModel;
  
  /**
   * Create a new Cohere embedding provider
   * 
   * @param options - Provider options
   * @param options.model - The model to use (defaults to embed-multilingual-v3.0)
   */
  constructor(options: {
    model?: string;
  } = {}) {
    this.embeddingModel = new CohereEmbeddingModel({
      model: options.model || 'embed-multilingual-v3.0'
    });
  }
  
  /**
   * Generate embeddings for a list of texts
   * 
   * @param texts - The texts to embed
   * @returns Array of embeddings (one per text)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      return await this.embeddingModel.embed(texts);
    } catch (error) {
      logger.error('Error generating Cohere embeddings', { error });
      throw error;
    }
  }
}

/**
 * Cohere embedding-based router
 */
export class CohereEmbeddingRouter extends EmbeddingRouter {
  /**
   * Create a new Cohere embedding router
   * 
   * @param options - Router options
   * @param options.model - The embedding model to use (defaults to embed-multilingual-v3.0)
   * @param options.agents - List of agents to route to
   * @param options.functions - List of functions to route to
   */
  constructor(options: {
    model?: string;
    agents?: Agent[];
    functions?: Function[];
  } = {}) {
    super({
      embeddingProvider: new CohereEmbeddingProvider({
        model: options.model || 'embed-multilingual-v3.0'
      }),
      agents: options.agents,
      functions: options.functions
    });
  }
}
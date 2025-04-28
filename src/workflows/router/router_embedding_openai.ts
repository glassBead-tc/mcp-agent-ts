/**
 * OpenAI embedding-based router for MCP Agent
 */
import { EmbeddingRouter, EmbeddingProvider } from './router_embedding';
import { Agent } from '../../agents/agent';
import { getLogger } from '../../logging/logger';
import { OpenAIEmbeddingModel } from '../embedding/embedding_openai';

const logger = getLogger('router_embedding_openai');

/**
 * OpenAI embedding provider implementation
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private embeddingModel: OpenAIEmbeddingModel;
  
  /**
   * Create a new OpenAI embedding provider
   * 
   * @param options - Provider options
   * @param options.model - The model to use (defaults to text-embedding-3-small)
   */
  constructor(options: {
    model?: string;
  } = {}) {
    this.embeddingModel = new OpenAIEmbeddingModel({
      model: options.model || 'text-embedding-3-small'
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
      logger.error('Error generating OpenAI embeddings', { error });
      throw error;
    }
  }
}

/**
 * OpenAI embedding-based router
 */
export class OpenAIEmbeddingRouter extends EmbeddingRouter {
  /**
   * Create a new OpenAI embedding router
   * 
   * @param options - Router options
   * @param options.model - The embedding model to use (defaults to text-embedding-3-small)
   * @param options.agents - List of agents to route to
   * @param options.functions - List of functions to route to
   */
  constructor(options: {
    model?: string;
    agents?: Agent[];
    functions?: Function[];
  } = {}) {
    super({
      embeddingProvider: new OpenAIEmbeddingProvider({
        model: options.model || 'text-embedding-3-small'
      }),
      agents: options.agents,
      functions: options.functions
    });
  }
}
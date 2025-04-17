/**
 * Embedding-based Router implementation for MCP Agent
 * 
 * This router uses embeddings to determine the most appropriate agent or function
 * for a given request.
 */
import { Agent } from '../../agents/agent';
import { RouterBase, RoutingResult } from './router_base';
import { getLogger } from '../../logging/logger';

const logger = getLogger('router_embedding');

/**
 * Interface for embedding providers
 */
export interface EmbeddingProvider {
  /**
   * Generate embeddings for a list of texts
   * 
   * @param texts - The texts to embed
   * @returns Array of embeddings (one per text)
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Calculate the cosine similarity between two vectors
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity (between -1 and 1)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Base embedding router class
 */
export abstract class EmbeddingRouter extends RouterBase {
  protected embeddingProvider: EmbeddingProvider;
  protected agentEmbeddings: Map<Agent, number[]> = new Map();
  protected functionEmbeddings: Map<Function, number[]> = new Map();
  protected initialized = false;
  
  /**
   * Create a new embedding router
   * 
   * @param options - Router options
   * @param options.embeddingProvider - The embedding provider to use
   * @param options.agents - List of agents to route to
   * @param options.functions - List of functions to route to
   */
  constructor(options: {
    embeddingProvider: EmbeddingProvider;
    agents?: Agent[];
    functions?: Function[];
  }) {
    super({
      agents: options.agents,
      functions: options.functions,
    });
    
    this.embeddingProvider = options.embeddingProvider;
  }
  
  /**
   * Initialize the router by generating embeddings for all agents and functions
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    logger.debug('Initializing embedding router');
    
    // Generate embeddings for agents
    if (this.agents.length > 0) {
      const agentTexts = this.agents.map(agent => {
        const instruction = typeof agent.instruction === 'function'
          ? agent.instruction({})
          : agent.instruction;
        
        return `${agent.name}: ${instruction}`;
      });
      
      const agentEmbeddings = await this.embeddingProvider.generateEmbeddings(agentTexts);
      
      for (let i = 0; i < this.agents.length; i++) {
        this.agentEmbeddings.set(this.agents[i], agentEmbeddings[i]);
      }
    }
    
    // Generate embeddings for functions
    if (this.functions.length > 0) {
      const functionTexts = this.functions.map(fn => {
        return `${fn.name}: ${fn.description || 'No description available'}`;
      });
      
      const functionEmbeddings = await this.embeddingProvider.generateEmbeddings(functionTexts);
      
      for (let i = 0; i < this.functions.length; i++) {
        this.functionEmbeddings.set(this.functions[i], functionEmbeddings[i]);
      }
    }
    
    this.initialized = true;
  }
  
  /**
   * Route a request to the top k most appropriate agents
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  async routeToAgent(
    request: string,
    topK: number = 1
  ): Promise<RoutingResult<Agent>[]> {
    if (this.agents.length === 0) {
      throw new Error('No agents available for routing');
    }
    
    // Initialize if not already initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Generate embedding for the request
    const [requestEmbedding] = await this.embeddingProvider.generateEmbeddings([request]);
    
    // Calculate similarity scores
    const scores: Array<{ agent: Agent; score: number }> = [];
    
    for (const agent of this.agents) {
      const embedding = this.agentEmbeddings.get(agent);
      
      if (!embedding) {
        logger.warn(`No embedding found for agent ${agent.name}`);
        continue;
      }
      
      const similarity = cosineSimilarity(requestEmbedding, embedding);
      
      scores.push({
        agent,
        score: (similarity + 1) / 2, // Convert from [-1, 1] to [0, 1]
      });
    }
    
    // Sort by score (descending) and take top k
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, topK);
    
    // Convert to routing results
    return topScores.map(({ agent, score }) => ({
      result: agent,
      score,
    }));
  }
  
  /**
   * Route a request to the top k most appropriate functions
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  async routeToFunction(
    request: string,
    topK: number = 1
  ): Promise<RoutingResult<Function>[]> {
    if (this.functions.length === 0) {
      throw new Error('No functions available for routing');
    }
    
    // Initialize if not already initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Generate embedding for the request
    const [requestEmbedding] = await this.embeddingProvider.generateEmbeddings([request]);
    
    // Calculate similarity scores
    const scores: Array<{ fn: Function; score: number }> = [];
    
    for (const fn of this.functions) {
      const embedding = this.functionEmbeddings.get(fn);
      
      if (!embedding) {
        logger.warn(`No embedding found for function ${fn.name}`);
        continue;
      }
      
      const similarity = cosineSimilarity(requestEmbedding, embedding);
      
      scores.push({
        fn,
        score: (similarity + 1) / 2, // Convert from [-1, 1] to [0, 1]
      });
    }
    
    // Sort by score (descending) and take top k
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, topK);
    
    // Convert to routing results
    return topScores.map(({ fn, score }) => ({
      result: fn,
      score,
    }));
  }
  
  /**
   * Route a request to the top k most appropriate agents or functions
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  async route(
    request: string,
    topK: number = 1
  ): Promise<RoutingResult<Agent | Function>[]> {
    if (this.agents.length === 0 && this.functions.length === 0) {
      throw new Error('No agents or functions available for routing');
    }
    
    // Initialize if not already initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Generate embedding for the request
    const [requestEmbedding] = await this.embeddingProvider.generateEmbeddings([request]);
    
    // Calculate similarity scores for agents
    const scores: Array<{ item: Agent | Function; score: number; type: 'agent' | 'function' }> = [];
    
    for (const agent of this.agents) {
      const embedding = this.agentEmbeddings.get(agent);
      
      if (!embedding) {
        logger.warn(`No embedding found for agent ${agent.name}`);
        continue;
      }
      
      const similarity = cosineSimilarity(requestEmbedding, embedding);
      
      scores.push({
        item: agent,
        score: (similarity + 1) / 2, // Convert from [-1, 1] to [0, 1]
        type: 'agent',
      });
    }
    
    // Calculate similarity scores for functions
    for (const fn of this.functions) {
      const embedding = this.functionEmbeddings.get(fn);
      
      if (!embedding) {
        logger.warn(`No embedding found for function ${fn.name}`);
        continue;
      }
      
      const similarity = cosineSimilarity(requestEmbedding, embedding);
      
      scores.push({
        item: fn,
        score: (similarity + 1) / 2, // Convert from [-1, 1] to [0, 1]
        type: 'function',
      });
    }
    
    // Sort by score (descending) and take top k
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, topK);
    
    // Convert to routing results
    return topScores.map(({ item, score, type }) => ({
      result: item,
      score,
      metadata: { type },
    }));
  }
}

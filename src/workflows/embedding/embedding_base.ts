/**
 * Base classes and utilities for embedding functionality
 */
import { ContextDependent } from '../../context_dependent';

/**
 * Type for embedding arrays (numeric vector representation of text)
 */
export type FloatArray = number[][];

/**
 * Abstract interface for embedding models
 */
export abstract class EmbeddingModel extends ContextDependent {
  /**
   * Generate embeddings for a list of messages
   * 
   * @param data - List of text strings to embed
   * @returns Array of embeddings, shape (len(texts), embedding_dim)
   */
  abstract embed(data: string[]): Promise<FloatArray>;
  
  /**
   * Return the dimensionality of the embeddings
   */
  abstract get embeddingDim(): number;
}

/**
 * Compute different similarity metrics between embeddings
 * 
 * @param embeddingA - First embedding
 * @param embeddingB - Second embedding
 * @returns Dictionary of similarity scores
 */
export function computeSimilarityScores(
  embeddingA: number[], 
  embeddingB: number[]
): Record<string, number> {
  // Compute cosine similarity
  const cosineSim = cosineSimilarity(embeddingA, embeddingB);
  
  // Could add other similarity metrics here
  return {
    cosine: cosineSim,
    // euclidean: euclideanSimilarity(embeddingA, embeddingB),
    // dotProduct: dotProduct(embeddingA, embeddingB)
  };
}

/**
 * Compute overall confidence score from individual similarity metrics
 * 
 * @param similarityScores - Dictionary of similarity scores
 * @returns Overall confidence score
 */
export function computeConfidence(similarityScores: Record<string, number>): number {
  // For now, just use cosine similarity as confidence
  // Could implement more sophisticated combination of scores
  return similarityScores.cosine;
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity value (-1 to 1)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
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
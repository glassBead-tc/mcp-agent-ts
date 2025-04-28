/**
 * Advanced model selection based on benchmarks and preferences
 */
import fs from 'fs';
import path from 'path';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('llm_selector');

/**
 * Model cost metrics
 */
export interface ModelCost {
  blended_cost_per_1m?: number;
  input_cost_per_1m?: number;
  output_cost_per_1m?: number;
}

/**
 * Model latency metrics
 */
export interface ModelLatency {
  time_to_first_token_ms: number;
  tokens_per_second: number;
}

/**
 * Model benchmark metrics
 */
export interface ModelBenchmarks {
  quality_score?: number;
  mmlu_score?: number;
  gsm8k_score?: number;
  bbh_score?: number;
  [key: string]: number | undefined;
}

/**
 * Combined model metrics
 */
export interface ModelMetrics {
  cost: ModelCost;
  speed: ModelLatency;
  intelligence: ModelBenchmarks;
}

/**
 * LLM metadata including performance benchmarks
 */
export interface ModelInfo {
  name: string;
  description?: string;
  provider: string;
  metrics: ModelMetrics;
}

/**
 * Model hint for selecting models
 */
export interface ModelHint {
  name?: string;
  provider?: string;
}

/**
 * Model preference settings
 */
export interface ModelPreferences {
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
  hints?: ModelHint[];
}

/**
 * A heuristic-based selector to choose the best model from a list of models
 */
export class ModelSelector {
  private models: ModelInfo[];
  private benchmarkWeights: Record<string, number>;
  private maxValues: Record<string, number>;
  private modelsByProvider: Record<string, ModelInfo[]>;

  /**
   * Create a new model selector
   * 
   * @param models - List of model information
   * @param benchmarkWeights - Weights for each benchmark metric
   */
  constructor(
    models?: ModelInfo[],
    benchmarkWeights?: Record<string, number>
  ) {
    this.models = models || loadDefaultModels();
    
    this.benchmarkWeights = benchmarkWeights || {
      mmlu: 0.4,
      gsm8k: 0.3,
      bbh: 0.3
    };
    
    // Validate weights
    const weightSum = Object.values(this.benchmarkWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 1e-6) {
      throw new Error("Benchmark weights must sum to 1.0");
    }
    
    this.maxValues = this.calculateMaxScores(this.models);
    this.modelsByProvider = this.groupModelsByProvider(this.models);
  }
  
  /**
   * Select the best model based on preferences
   * 
   * @param modelPreferences - Model preferences
   * @param provider - Optional provider to filter by
   * @returns The best model based on the criteria
   */
  selectBestModel(modelPreferences: ModelPreferences, provider?: string): ModelInfo {
    let candidateModels: ModelInfo[] = [];
    
    if (provider) {
      candidateModels = this.modelsByProvider[provider] || [];
    } else {
      candidateModels = this.models;
    }
    
    if (candidateModels.length === 0) {
      throw new Error(`No models available for selection. Provider=${provider}`);
    }
    
    // Filter by hints if available
    if (modelPreferences.hints && modelPreferences.hints.length > 0) {
      const hintMatchedModels: ModelInfo[] = [];
      
      for (const model of candidateModels) {
        for (const hint of modelPreferences.hints) {
          if (this.checkModelHint(model, hint)) {
            hintMatchedModels.push(model);
            break;
          }
        }
      }
      
      if (hintMatchedModels.length > 0) {
        candidateModels = hintMatchedModels;
      }
    }
    
    // Score each model
    const scores: [number, ModelInfo][] = [];
    
    for (const model of candidateModels) {
      const costScore = this.calculateCostScore(
        model, 
        modelPreferences, 
        this.maxValues["max_cost"]
      );
      
      const speedScore = this.calculateSpeedScore(
        model,
        this.maxValues["max_tokens_per_second"],
        this.maxValues["max_time_to_first_token_ms"]
      );
      
      const intelligenceScore = this.calculateIntelligenceScore(model, this.maxValues);
      
      const modelScore = 
        (modelPreferences.costPriority || 0) * costScore +
        (modelPreferences.speedPriority || 0) * speedScore +
        (modelPreferences.intelligencePriority || 0) * intelligenceScore;
      
      scores.push([modelScore, model]);
    }
    
    // Find the model with the highest score
    let bestScore = -Infinity;
    let bestModel: ModelInfo | null = null;
    
    for (const [score, model] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }
    
    if (!bestModel) {
      throw new Error("Failed to select a model");
    }
    
    return bestModel;
  }
  
  /**
   * Group models by provider
   * 
   * @param models - List of models to group
   * @returns Record of provider to models
   */
  private groupModelsByProvider(models: ModelInfo[]): Record<string, ModelInfo[]> {
    const result: Record<string, ModelInfo[]> = {};
    
    for (const model of models) {
      if (!result[model.provider]) {
        result[model.provider] = [];
      }
      result[model.provider].push(model);
    }
    
    return result;
  }
  
  /**
   * Check if a model matches a hint
   * 
   * @param model - Model to check
   * @param hint - Hint to match against
   * @returns Whether the model matches the hint
   */
  private checkModelHint(model: ModelInfo, hint: ModelHint): boolean {
    let nameMatch = true;
    if (hint.name) {
      nameMatch = fuzzyMatch(hint.name, model.name);
    }
    
    let providerMatch = true;
    if (hint.provider) {
      providerMatch = fuzzyMatch(hint.provider, model.provider);
    }
    
    return nameMatch && providerMatch;
  }
  
  /**
   * Calculate the total cost of a model
   * 
   * @param model - Model to calculate cost for
   * @param ioRatio - Ratio of input to output tokens
   * @returns Total cost per million tokens
   */
  private calculateTotalCost(model: ModelInfo, ioRatio: number = 3.0): number {
    if (model.metrics.cost.blended_cost_per_1m !== undefined) {
      return model.metrics.cost.blended_cost_per_1m;
    }
    
    const inputCost = model.metrics.cost.input_cost_per_1m || 0;
    const outputCost = model.metrics.cost.output_cost_per_1m || 0;
    
    const totalCost = (inputCost * ioRatio + outputCost) / (1 + ioRatio);
    return totalCost;
  }
  
  /**
   * Calculate the cost score for a model
   * 
   * @param model - Model to calculate score for
   * @param modelPreferences - Model preferences
   * @param maxCost - Maximum cost of any model
   * @returns Normalized cost score (0-1)
   */
  private calculateCostScore(
    model: ModelInfo,
    modelPreferences: ModelPreferences,
    maxCost: number
  ): number {
    const totalCost = this.calculateTotalCost(model, 3.0);
    return 1 - (totalCost / maxCost);
  }
  
  /**
   * Calculate the intelligence score for a model
   * 
   * @param model - Model to calculate score for
   * @param maxValues - Maximum benchmark values
   * @returns Normalized intelligence score (0-1)
   */
  private calculateIntelligenceScore(
    model: ModelInfo,
    maxValues: Record<string, number>
  ): number {
    const scores: number[] = [];
    const weights: number[] = [];
    
    const benchmarks = model.metrics.intelligence;
    let useWeights = true;
    
    for (const [bench, score] of Object.entries(benchmarks)) {
      const key = `max_${bench}`;
      if (score !== undefined && maxValues[key]) {
        scores.push(score / maxValues[key]);
        if (this.benchmarkWeights[bench]) {
          weights.push(this.benchmarkWeights[bench]);
        } else {
          useWeights = false;
        }
      }
    }
    
    if (scores.length === 0) {
      return 0;
    } else if (useWeights) {
      return weightedAverage(scores, weights);
    } else {
      return average(scores);
    }
  }
  
  /**
   * Calculate the speed score for a model
   * 
   * @param model - Model to calculate score for
   * @param maxTokensPerSecond - Maximum tokens per second of any model
   * @param maxTimeToFirstToken - Maximum time to first token of any model
   * @returns Normalized speed score (0-1)
   */
  private calculateSpeedScore(
    model: ModelInfo,
    maxTokensPerSecond: number,
    maxTimeToFirstToken: number
  ): number {
    const timeToFirstTokenScore = 1 - (
      model.metrics.speed.time_to_first_token_ms / maxTimeToFirstToken
    );
    
    const tokensPerSecondScore = model.metrics.speed.tokens_per_second / maxTokensPerSecond;
    
    return weightedAverage(
      [timeToFirstTokenScore, tokensPerSecondScore],
      [0.4, 0.6]
    );
  }
  
  /**
   * Calculate maximum values for all metrics
   * 
   * @param models - List of models
   * @returns Record of maximum values
   */
  private calculateMaxScores(models: ModelInfo[]): Record<string, number> {
    const maxDict: Record<string, number> = {};
    
    // Calculate maximum cost
    maxDict["max_cost"] = Math.max(...models.map(m => this.calculateTotalCost(m)));
    
    // Calculate maximum speed metrics
    maxDict["max_tokens_per_second"] = Math.max(
      ...models.map(m => m.metrics.speed.tokens_per_second),
      1e-6
    );
    
    maxDict["max_time_to_first_token_ms"] = Math.max(
      ...models.map(m => m.metrics.speed.time_to_first_token_ms),
      1e-6
    );
    
    // Calculate maximum intelligence metrics
    for (const model of models) {
      for (const [bench, score] of Object.entries(model.metrics.intelligence)) {
        if (score === undefined) continue;
        
        const key = `max_${bench}`;
        if (maxDict[key]) {
          maxDict[key] = Math.max(maxDict[key], score);
        } else {
          maxDict[key] = score;
        }
      }
    }
    
    return maxDict;
  }
}

/**
 * Load default models from benchmarks file
 * 
 * @returns List of model information
 */
function loadDefaultModels(): ModelInfo[] {
  try {
    const dataPath = path.join(__dirname, '../../../src/mcp_agent/data/artificial_analysis_llm_benchmarks.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return data as ModelInfo[];
  } catch (error) {
    logger.warn('Failed to load default models', { error });
    return [];
  }
}

/**
 * Fuzzy match two strings
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @param threshold - Minimum similarity to consider a match
 * @returns Whether the strings match above the threshold
 */
function fuzzyMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Simple implementation - compare first few characters
  // In a real implementation, we would use a proper string similarity algorithm
  return s1.includes(s2) || s2.includes(s1);
}

/**
 * Calculate average of an array of numbers
 * 
 * @param values - Array of values
 * @returns Average value
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate weighted average of an array of numbers
 * 
 * @param values - Array of values
 * @param weights - Array of weights
 * @returns Weighted average
 */
function weightedAverage(values: number[], weights: number[]): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  
  let sum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * weights[i];
    weightSum += weights[i];
  }
  
  return sum / weightSum;
}
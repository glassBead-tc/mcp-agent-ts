/**
 * Model selector for MCP Agent
 */
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('model_selector');

/**
 * Model configuration
 */
export interface ModelConfig {
  name: string;
  provider: string;
  api_key?: string;
  base_url?: string;
  options?: Record<string, any>;
  [key: string]: any;
}

/**
 * Model selector for selecting LLM models
 */
export class ModelSelector {
  private models: Map<string, ModelConfig> = new Map();
  private defaultModel?: string;
  
  constructor(
    models: Record<string, ModelConfig> = {},
    defaultModel?: string
  ) {
    // Register models
    for (const [name, config] of Object.entries(models)) {
      this.registerModel(name, config);
    }
    
    // Set default model
    if (defaultModel && this.models.has(defaultModel)) {
      this.defaultModel = defaultModel;
    } else if (this.models.size > 0) {
      this.defaultModel = Array.from(this.models.keys())[0];
    }
  }
  
  /**
   * Register a model
   */
  registerModel(name: string, config: ModelConfig): void {
    logger.debug(`Registering model ${name}`, { config });
    this.models.set(name, config);
    
    // Set as default if no default is set
    if (!this.defaultModel) {
      this.defaultModel = name;
    }
  }
  
  /**
   * Get a model by name
   */
  getModel(name?: string): ModelConfig | undefined {
    if (!name) {
      if (!this.defaultModel) {
        return undefined;
      }
      return this.models.get(this.defaultModel);
    }
    
    return this.models.get(name);
  }
  
  /**
   * List all registered models
   */
  listModels(): { name: string; config: ModelConfig }[] {
    return Array.from(this.models.entries()).map(([name, config]) => ({
      name,
      config,
    }));
  }
  
  /**
   * Set the default model
   */
  setDefaultModel(name: string): void {
    if (!this.models.has(name)) {
      throw new Error(`Model ${name} not found`);
    }
    
    this.defaultModel = name;
  }
  
  /**
   * Get the default model
   */
  getDefaultModel(): ModelConfig | undefined {
    if (!this.defaultModel) {
      return undefined;
    }
    
    return this.models.get(this.defaultModel);
  }
  
  /**
   * Select a model based on criteria
   */
  selectModel(criteria: {
    provider?: string;
    minTokens?: number;
    maxPrice?: number;
    [key: string]: any;
  } = {}): ModelConfig | undefined {
    // This is a simplified implementation - in a real implementation,
    // we would use more sophisticated criteria matching
    
    // If provider is specified, filter by provider
    if (criteria.provider) {
      const matchingModels = Array.from(this.models.values()).filter(
        model => model.provider === criteria.provider
      );
      
      if (matchingModels.length > 0) {
        return matchingModels[0];
      }
    }
    
    // Fall back to default model
    return this.getDefaultModel();
  }
}

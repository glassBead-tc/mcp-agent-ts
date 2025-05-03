/**
 * Model selector for LLM workflows
 * Provides model selection capabilities for LLM workflows
 */
import { getLogger } from "../../logging/logger.js";

const logger = getLogger("model-selector");

/**
 * Model configuration interface
 */
export interface ModelConfig {
  provider: string;
  model: string;
  parameters?: Record<string, any>;
  priority?: number;
}

/**
 * Model selector interface
 */
export interface ModelSelector {
  /**
   * Get the best model for a given task
   * @param task Task name or description
   * @param options Selection options
   * @returns The best model configuration for the task
   */
  selectModel(task: string, options?: ModelSelectionOptions): ModelConfig;

  /**
   * Get a model by name
   * @param name Model name (provider/model)
   * @returns Model configuration
   */
  getModel(name: string): ModelConfig | undefined;

  /**
   * Get all available models
   * @returns All model configurations
   */
  getModels(): ModelConfig[];

  /**
   * Add a model configuration
   * @param model Model configuration
   */
  addModel(model: ModelConfig): void;
}

/**
 * Model selection options
 */
export interface ModelSelectionOptions {
  provider?: string;
  minTokens?: number;
  maxTokens?: number;
  features?: string[];
}

/**
 * Default model selector implementation
 */
export class DefaultModelSelector implements ModelSelector {
  private models: Map<string, ModelConfig> = new Map();

  constructor(initialModels: ModelConfig[] = []) {
    initialModels.forEach((model) => this.addModel(model));
  }

  /**
   * Add a model configuration
   * @param model Model configuration
   */
  addModel(model: ModelConfig): void {
    const key = `${model.provider}/${model.model}`;
    this.models.set(key, model);
    logger.debug(`Added model: ${key}`);
  }

  /**
   * Get a model by name
   * @param name Model name (provider/model)
   * @returns Model configuration
   */
  getModel(name: string): ModelConfig | undefined {
    return this.models.get(name);
  }

  /**
   * Get all available models
   * @returns All model configurations
   */
  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  /**
   * Select the best model for a task
   * @param task Task name or description
   * @param options Selection options
   * @returns The best model configuration for the task
   */
  selectModel(task: string, options: ModelSelectionOptions = {}): ModelConfig {
    logger.debug(`Selecting model for task: ${task}`, options);

    // Filter models by provider if specified
    let candidates = this.getModels();
    if (options.provider) {
      candidates = candidates.filter(
        (model) => model.provider === options.provider
      );
    }

    // TODO: Apply more sophisticated filtering/selection logic based on task and options

    // Sort by priority (higher is better)
    candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (candidates.length === 0) {
      throw new Error(`No suitable model found for task: ${task}`);
    }

    const selected = candidates[0];
    logger.debug(
      `Selected model: ${selected.provider}/${selected.model} for task: ${task}`
    );

    return selected;
  }

  /**
   * Create a selector with default models
   * @returns A model selector with default models
   */
  static createWithDefaults(): ModelSelector {
    const selector = new DefaultModelSelector([
      {
        provider: "openai",
        model: "gpt-4o",
        priority: 100,
        parameters: {
          max_tokens: 4096,
          temperature: 0.7,
        },
      },
      {
        provider: "openai",
        model: "gpt-3.5-turbo",
        priority: 50,
        parameters: {
          max_tokens: 2048,
          temperature: 0.7,
        },
      },
      {
        provider: "anthropic",
        model: "claude-3.5-haiku",
        priority: 90,
        parameters: {
          max_tokens: 4096,
          temperature: 0.7,
        },
      },
    ]);

    return selector;
  }
}

import { MCPApp } from '../../src/app';
import { getLogger } from '../../src/logging/logger';

// Import types that would be available in TypeScript version
interface ModelHint {
  name: string;
  version?: string;
  provider?: string;
}

interface ModelPreferences {
  costPriority: number;
  speedPriority: number;
  intelligencePriority: number;
  hints?: ModelHint[];
}

// Mock ModelInfo interface that would be returned by a real implementation
interface ModelInfo {
  name: string;
  provider: string;
  cost: number;
  speed: number;
  intelligence: number;
}

// Mock ModelSelector implementation for the example
class ModelSelector {
  private models: Map<string, ModelInfo> = new Map();

  constructor() {
    // Initialize with some sample models
    this.initializeModels();
  }

  private initializeModels() {
    // OpenAI models
    this.models.set('gpt-4o', {
      name: 'gpt-4o',
      provider: 'OpenAI',
      cost: 0.5,
      speed: 0.7,
      intelligence: 0.9
    });

    this.models.set('gpt-4o-mini', {
      name: 'gpt-4o-mini',
      provider: 'OpenAI',
      cost: 0.3,
      speed: 0.8,
      intelligence: 0.7
    });

    this.models.set('gpt-3.5-turbo', {
      name: 'gpt-3.5-turbo',
      provider: 'OpenAI',
      cost: 0.1,
      speed: 0.9,
      intelligence: 0.6
    });

    // Anthropic models
    this.models.set('claude-3-opus-20240229', {
      name: 'claude-3-opus-20240229',
      provider: 'Anthropic',
      cost: 0.6,
      speed: 0.6,
      intelligence: 0.95
    });

    this.models.set('claude-3-sonnet-20240229', {
      name: 'claude-3-sonnet-20240229',
      provider: 'Anthropic',
      cost: 0.4,
      speed: 0.7,
      intelligence: 0.8
    });

    this.models.set('claude-3-haiku-20240307', {
      name: 'claude-3-haiku-20240307',
      provider: 'Anthropic',
      cost: 0.25,
      speed: 0.85,
      intelligence: 0.7
    });
  }

  // Method to select the best model based on preferences
  selectBestModel(options: {
    model_preferences: ModelPreferences;
    provider?: string;
  }): ModelInfo {
    const { model_preferences, provider } = options;
    
    let filteredModels = Array.from(this.models.values());
    
    // Filter by provider if specified
    if (provider) {
      filteredModels = filteredModels.filter(model => 
        model.provider.toLowerCase() === provider.toLowerCase()
      );
    }
    
    // Filter by hints if specified
    if (model_preferences.hints && model_preferences.hints.length > 0) {
      const hintNames = model_preferences.hints.map(hint => hint.name.toLowerCase());
      filteredModels = filteredModels.filter(model => 
        hintNames.some(hintName => model.name.toLowerCase().includes(hintName))
      );
    }

    if (filteredModels.length === 0) {
      throw new Error(`No models found with the specified criteria: Provider=${provider || 'Any'}`);
    }
    
    // Calculate scores based on preferences
    const scoredModels = filteredModels.map(model => {
      const costScore = (1 - model.cost) * model_preferences.costPriority;
      const speedScore = model.speed * model_preferences.speedPriority;
      const intelligenceScore = model.intelligence * model_preferences.intelligencePriority;
      
      const totalScore = costScore + speedScore + intelligenceScore;
      
      return {
        model,
        score: totalScore
      };
    });
    
    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score);
    
    // Return the best model
    return scoredModels[0].model;
  }
}

const app = new MCPApp({ name: "llm_selector" });

// Example usage function
async function exampleUsage(modelSelector: ModelSelector) {
  const logger = getLogger("llm_selector.example_usage");

  // Select the smartest OpenAI model
  const smartestOpenAiPreferences: ModelPreferences = {
    costPriority: 0,
    speedPriority: 0,
    intelligencePriority: 1.0
  };
  
  const smartestOpenAiModel = modelSelector.selectBestModel({
    model_preferences: smartestOpenAiPreferences,
    provider: "OpenAI"
  });
  
  logger.info("Smartest OpenAI model:", {
    data: {
      model_preferences: smartestOpenAiPreferences,
      model: smartestOpenAiModel
    }
  });

  // Select the most balanced OpenAI model
  const balancedOpenAiPreferences: ModelPreferences = {
    costPriority: 0.25,
    speedPriority: 0.25,
    intelligencePriority: 0.5
  };
  
  const balancedOpenAiModel = modelSelector.selectBestModel({
    model_preferences: balancedOpenAiPreferences,
    provider: "OpenAI"
  });
  
  logger.info("Most balanced OpenAI model:", {
    data: {
      model_preferences: balancedOpenAiPreferences,
      model: balancedOpenAiModel
    }
  });

  // Select the fastest and cheapest OpenAI model
  const fastCheapOpenAiPreferences: ModelPreferences = {
    costPriority: 0.3,
    speedPriority: 0.6,
    intelligencePriority: 0.1
  };
  
  const fastCheapOpenAiModel = modelSelector.selectBestModel({
    model_preferences: fastCheapOpenAiPreferences,
    provider: "OpenAI"
  });
  
  logger.info("Fastest and cheapest OpenAI model:", {
    data: {
      model_preferences: fastCheapOpenAiPreferences,
      model: fastCheapOpenAiModel
    }
  });

  // Select the smartest Anthropic model
  const smartestAnthropicPreferences: ModelPreferences = {
    costPriority: 0.1,
    speedPriority: 0.1,
    intelligencePriority: 0.8
  };
  
  const smartestAnthropicModel = modelSelector.selectBestModel({
    model_preferences: smartestAnthropicPreferences,
    provider: "Anthropic"
  });
  
  logger.info("Smartest Anthropic model:", {
    data: {
      model_preferences: smartestAnthropicPreferences,
      model: smartestAnthropicModel
    }
  });

  // Select the cheapest Anthropic model
  const cheapestAnthropicPreferences: ModelPreferences = {
    costPriority: 0.8,
    speedPriority: 0.1,
    intelligencePriority: 0.1
  };
  
  const cheapestAnthropicModel = modelSelector.selectBestModel({
    model_preferences: cheapestAnthropicPreferences,
    provider: "Anthropic"
  });
  
  logger.info("Cheapest Anthropic model:", {
    data: {
      model_preferences: cheapestAnthropicPreferences,
      model: cheapestAnthropicModel
    }
  });

  // Select fastest model between specific models
  const fastestSpecificPreferences: ModelPreferences = {
    costPriority: 0.1,
    speedPriority: 0.8,
    intelligencePriority: 0.1,
    hints: [
      { name: "gpt-4o" },
      { name: "gpt-4o-mini" },
      { name: "claude-3.5-sonnet" },
      { name: "claude-3-haiku" }
    ]
  };
  
  const fastestSpecificModel = modelSelector.selectBestModel({
    model_preferences: fastestSpecificPreferences
  });
  
  logger.info("Select fastest model between gpt-4o/mini/sonnet/haiku:", {
    data: {
      model_preferences: fastestSpecificPreferences,
      model: fastestSpecificModel
    }
  });

  // Select most balanced model between specific models with fuzzy matching
  const balancedSpecificPreferences: ModelPreferences = {
    costPriority: 0.15,
    speedPriority: 0.15,
    intelligencePriority: 0.7,
    hints: [
      { name: "gpt-4o" },
      { name: "gpt-4o-mini" },
      { name: "claude-sonnet" }, // Fuzzy name matching
      { name: "claude-haiku" } // Fuzzy name matching
    ]
  };
  
  const balancedSpecificModel = modelSelector.selectBestModel({
    model_preferences: balancedSpecificPreferences
  });
  
  logger.info("Most balanced model between gpt-4o/mini/sonnet/haiku:", {
    data: {
      model_preferences: balancedSpecificPreferences,
      model: balancedSpecificModel
    }
  });
}

// Main function
async function main() {
  try {
    await app.initialize();
    
    console.time("Model selector setup");
    const modelSelector = new ModelSelector();
    console.timeEnd("Model selector setup");
    
    console.time("ModelSelector usage");
    await exampleUsage(modelSelector);
    console.timeEnd("ModelSelector usage");
  } finally {
    await app.shutdown();
  }
}

// Run the example
main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
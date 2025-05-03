import { MCPApp } from '../../src/app';
import { getLogger } from '../../src/logging/logger';
import readline from 'readline';

// Types for model selection
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

// Mock ModelInfo interface
interface ModelInfo {
  name: string;
  provider: string;
  cost: number;
  speed: number;
  intelligence: number;
}

// Mock ModelSelector implementation
class ModelSelector {
  private models: Map<string, ModelInfo> = new Map();

  constructor() {
    // Initialize with sample models
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

    // Add models from other providers
    this.models.set('mistral-large', {
      name: 'mistral-large',
      provider: 'Mistral',
      cost: 0.4,
      speed: 0.75,
      intelligence: 0.85
    });

    this.models.set('llama-3-70b', {
      name: 'llama-3-70b',
      provider: 'Together.ai',
      cost: 0.3,
      speed: 0.65,
      intelligence: 0.82
    });
  }

  selectBestModel(options: {
    model_preferences: ModelPreferences;
    provider?: string;
  }): ModelInfo {
    const { model_preferences, provider } = options;
    
    let filteredModels = Array.from(this.models.values());
    
    // Filter by provider if specified
    if (provider && provider !== "All") {
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

// Function to get a valid float input from the user
async function getValidFloatInput(
  rl: readline.Interface,
  promptText: string,
  minVal: number = 0.0,
  maxVal: number = 1.0
): Promise<number | null> {
  while (true) {
    const answer = await new Promise<string>(resolve => {
      rl.question(promptText, resolve);
    });
    
    if (answer.trim() === '') {
      return null;
    }
    
    const value = parseFloat(answer);
    if (!isNaN(value) && value >= minVal && value <= maxVal) {
      return value;
    }
    
    console.log(`Please enter a value between ${minVal} and ${maxVal}`);
  }
}

// Function to display preferences table
function displayPreferencesTable(
  cost: number,
  speed: number,
  intelligence: number,
  provider: string
): void {
  console.log('\n--- Current Preferences ---');
  console.log(`Cost priority:        ${cost.toFixed(2)}`);
  console.log(`Speed priority:       ${speed.toFixed(2)}`);
  console.log(`Intelligence priority: ${intelligence.toFixed(2)}`);
  console.log(`Provider:             ${provider}`);
  console.log('---------------------------\n');
}

// Function to display model selection result
function displayModelResult(
  model: ModelInfo,
  preferences: { cost: number; speed: number; intelligence: number },
  provider: string
): void {
  console.log('\n=== Model Selection Result ===');
  console.log(`Selected Model:       ${model.name}`);
  console.log(`Provider:             ${model.provider}`);
  console.log(`Cost Score:           ${model.cost.toFixed(2)}`);
  console.log(`Speed Score:          ${model.speed.toFixed(2)}`);
  console.log(`Intelligence Score:   ${model.intelligence.toFixed(2)}`);
  console.log('\nSelection Preferences:');
  console.log(`Cost Priority:        ${preferences.cost.toFixed(2)}`);
  console.log(`Speed Priority:       ${preferences.speed.toFixed(2)}`);
  console.log(`Intelligence Priority: ${preferences.intelligence.toFixed(2)}`);
  console.log(`Provider Filter:      ${provider}`);
  console.log('===============================\n');
}

// Interactive model selection function
async function interactiveModelSelection(modelSelector: ModelSelector): Promise<void> {
  const logger = getLogger("llm_selector.interactive");
  const providers = [
    "All",
    "AI21 Labs",
    "Amazon Bedrock",
    "Anthropic",
    "Cerebras",
    "Cohere",
    "Databricks",
    "DeepSeek",
    "Deepinfra",
    "Fireworks",
    "FriendliAI",
    "Google AI Studio",
    "Google Vertex",
    "Groq",
    "Hyperbolic",
    "Microsoft Azure",
    "Mistral",
    "Nebius",
    "Novita",
    "OpenAI",
    "Perplexity",
    "Replicate",
    "SambaNova",
    "Together.ai",
    "xAI",
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Main loop
  while (true) {
    console.clear();
    console.log('=== Model Selection Interface ===');
    console.log('Enter values between 0.0 and 1.0 for each priority');
    console.log('Press Enter without input to exit\n');

    // Get priorities
    const costPriority = await getValidFloatInput(rl, 'Cost Priority (0-1): ');
    if (costPriority === null) break;

    const speedPriority = await getValidFloatInput(rl, 'Speed Priority (0-1): ');
    if (speedPriority === null) break;

    const intelligencePriority = await getValidFloatInput(rl, 'Intelligence Priority (0-1): ');
    if (intelligencePriority === null) break;

    // Provider selection
    console.log('\nAvailable Providers:');
    providers.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider}`);
    });

    const providerChoiceInput = await new Promise<string>(resolve => {
      rl.question('\nSelect provider (number): ', resolve);
    });
    
    const providerChoiceNum = parseInt(providerChoiceInput, 10) || 1;
    const selectedProvider = providers[Math.min(providerChoiceNum - 1, providers.length - 1)];

    // Display current preferences
    displayPreferencesTable(
      costPriority,
      speedPriority,
      intelligencePriority,
      selectedProvider
    );

    // Create model preferences
    const modelPreferences: ModelPreferences = {
      costPriority,
      speedPriority,
      intelligencePriority
    };

    // Select model
    console.log('Selecting best model...');
    
    try {
      let model: ModelInfo;
      
      if (selectedProvider === 'All') {
        model = modelSelector.selectBestModel({
          model_preferences: modelPreferences
        });
      } else {
        model = modelSelector.selectBestModel({
          model_preferences: modelPreferences,
          provider: selectedProvider
        });
      }

      // Display result
      displayModelResult(
        model,
        {
          cost: costPriority,
          speed: speedPriority,
          intelligence: intelligencePriority
        },
        selectedProvider
      );

      logger.info('Interactive model selection result:', {
        data: {
          model_preferences: modelPreferences,
          provider: selectedProvider,
          model
        }
      });
    } catch (error) {
      console.error(`Error selecting model: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Error in model selection', { error });
    }

    // Continue?
    const continueAnswer = await new Promise<string>(resolve => {
      rl.question('\nContinue? (y/n) [y]: ', resolve);
    });
    
    if (continueAnswer.toLowerCase() === 'n') {
      break;
    }
  }

  rl.close();
}

// Main function
async function main() {
  try {
    await app.initialize();
    
    console.log('Loading model selector...');
    const modelSelector = new ModelSelector();
    console.log('Model selector loaded!');
    
    await interactiveModelSelection(modelSelector);
  } finally {
    await app.shutdown();
  }
}

// Run the interactive example
main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
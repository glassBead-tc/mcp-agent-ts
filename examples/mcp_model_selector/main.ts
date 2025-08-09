import { MCPApp } from '../../src';
import { ModelSelector, ModelHint, ModelPreferences } from '../../src/workflows/llm/index.js';

async function exampleUsage(selector: ModelSelector): Promise<void> {
  const logger = console;

  let prefs: ModelPreferences = { costPriority: 0, speedPriority: 0, intelligencePriority: 1.0 };
  let model = selector.selectBestModel(prefs, 'OpenAI');
  logger.log('Smartest OpenAI model:', model);

  prefs = { costPriority: 0.25, speedPriority: 0.25, intelligencePriority: 0.5 };
  model = selector.selectBestModel(prefs, 'OpenAI');
  logger.log('Most balanced OpenAI model:', model);

  prefs = { costPriority: 0.3, speedPriority: 0.6, intelligencePriority: 0.1 };
  model = selector.selectBestModel(prefs, 'OpenAI');
  logger.log('Fastest and cheapest OpenAI model:', model);

  prefs = { costPriority: 0.1, speedPriority: 0.1, intelligencePriority: 0.8 };
  model = selector.selectBestModel(prefs, 'Anthropic');
  logger.log('Smartest Anthropic model:', model);

  prefs = { costPriority: 0.8, speedPriority: 0.1, intelligencePriority: 0.1 };
  model = selector.selectBestModel(prefs, 'Anthropic');
  logger.log('Cheapest Anthropic model:', model);

  prefs = {
    costPriority: 0.1,
    speedPriority: 0.8,
    intelligencePriority: 0.1,
    hints: [
      { name: 'gpt-4o' },
      { name: 'gpt-4o-mini' },
      { name: 'claude-3.5-sonnet' },
      { name: 'claude-3-haiku' },
    ],
  };
  model = selector.selectBestModel(prefs);
  logger.log('Select fastest model between gpt-4o/mini/sonnet/haiku:', model);

  prefs = {
    costPriority: 0.15,
    speedPriority: 0.15,
    intelligencePriority: 0.7,
    hints: [
      { name: 'gpt-4o' },
      { name: 'gpt-4o-mini' },
      { name: 'claude-sonnet' },
      { name: 'claude-haiku' },
    ],
  };
  model = selector.selectBestModel(prefs);
  logger.log('Most balanced model between gpt-4o/mini/sonnet/haiku:', model);
}

async function main() {
  const app = new MCPApp({ name: 'llm_selector' });
  await app.initialize();
  try {
    const selector = new ModelSelector();
    await exampleUsage(selector);
  } finally {
    await app.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

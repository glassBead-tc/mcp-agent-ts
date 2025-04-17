/**
 * Orchestrator Comparison Example
 * 
 * This example demonstrates the differences between full planning and iterative planning
 * in the Orchestrator workflow pattern.
 */
import { 
  MCPApp, 
  Agent, 
  OpenAIAugmentedLLM,
  Orchestrator,
  PlanType
} from '../src';

/**
 * Example function to get current time
 */
async function getCurrentTime(): Promise<string> {
  return new Date().toISOString();
}

/**
 * Example function to get weather
 */
async function getWeather(location: string): Promise<string> {
  return `Weather for ${location}: Sunny, 75°F`;
}

/**
 * Example function to search for information
 */
async function searchInformation(query: string): Promise<string> {
  return `Search results for "${query}": This is a mock search result.`;
}

/**
 * Main function
 */
async function main() {
  // Create app
  const app = new MCPApp({
    name: 'orchestrator-comparison',
  });
  
  // Run the app
  await app.run(async (app) => {
    console.log('Creating agents...');
    
    // Create agents for different purposes
    const researchAgent = new Agent({
      name: 'researcher',
      instruction: 'You are a research agent that finds information about topics.',
      functions: [getCurrentTime, getWeather, searchInformation],
      context: app.context,
    });
    
    const writerAgent = new Agent({
      name: 'writer',
      instruction: 'You are a writer agent that creates content based on research.',
      context: app.context,
    });
    
    const editorAgent = new Agent({
      name: 'editor',
      instruction: 'You are an editor agent that reviews and improves content.',
      context: app.context,
    });
    
    const factCheckerAgent = new Agent({
      name: 'fact_checker',
      instruction: 'You are a fact checker agent that verifies information in content.',
      functions: [searchInformation],
      context: app.context,
    });
    
    const summarizerAgent = new Agent({
      name: 'summarizer',
      instruction: 'You are a summarizer agent that condenses information into concise summaries.',
      context: app.context,
    });
    
    // Initialize all agents
    await Promise.all([
      researchAgent.initialize(),
      writerAgent.initialize(),
      editorAgent.initialize(),
      factCheckerAgent.initialize(),
      summarizerAgent.initialize(),
    ]);
    
    // Create LLM factory function
    const llmFactory = async (agent: Agent) => {
      return new OpenAIAugmentedLLM({
        agent,
        model: 'gpt-4o',
      });
    };
    
    // Run comparison for different tasks
    await runComparison(
      'Simple Task', 
      'Write a short blog post about the benefits of exercise.',
      [researchAgent, writerAgent, editorAgent, factCheckerAgent, summarizerAgent],
      llmFactory
    );
    
    await runComparison(
      'Complex Task', 
      'Create a comprehensive guide to starting a small business, including research on market analysis, funding options, legal requirements, and marketing strategies.',
      [researchAgent, writerAgent, editorAgent, factCheckerAgent, summarizerAgent],
      llmFactory
    );
    
    await runComparison(
      'Adaptive Task', 
      'Research the latest advancements in renewable energy technologies and create a report on which ones are most promising for immediate implementation.',
      [researchAgent, writerAgent, editorAgent, factCheckerAgent, summarizerAgent],
      llmFactory
    );
    
    // Shutdown all agents
    await Promise.all([
      researchAgent.shutdown(),
      writerAgent.shutdown(),
      editorAgent.shutdown(),
      factCheckerAgent.shutdown(),
      summarizerAgent.shutdown(),
    ]);
  });
}

/**
 * Run a comparison between full planning and iterative planning for a given task
 */
async function runComparison(
  taskName: string,
  taskDescription: string,
  agents: Agent[],
  llmFactory: (agent: Agent) => Promise<OpenAIAugmentedLLM>
) {
  console.log(`\n\n=== Comparing Planning Approaches for: ${taskName} ===`);
  console.log(`Task: ${taskDescription}`);
  
  // Run with full planning
  console.log('\n--- Full Planning ---');
  const startFull = Date.now();
  
  const orchestratorFull = new Orchestrator({
    availableAgents: agents,
    llmFactory,
    planType: 'full',
  });
  
  console.log('Generating plan and executing...');
  const fullResult = await orchestratorFull.complete([
    { role: 'user', content: taskDescription }
  ]);
  
  const fullTime = Date.now() - startFull;
  console.log(`Completed in ${fullTime}ms`);
  console.log(`Result (excerpt): ${fullResult.choices[0].message.content.substring(0, 150)}...`);
  
  // Run with iterative planning
  console.log('\n--- Iterative Planning ---');
  const startIterative = Date.now();
  
  const orchestratorIterative = new Orchestrator({
    availableAgents: agents,
    llmFactory,
    planType: 'iterative',
  });
  
  console.log('Generating and executing steps iteratively...');
  const iterativeResult = await orchestratorIterative.complete([
    { role: 'user', content: taskDescription }
  ]);
  
  const iterativeTime = Date.now() - startIterative;
  console.log(`Completed in ${iterativeTime}ms`);
  console.log(`Result (excerpt): ${iterativeResult.choices[0].message.content.substring(0, 150)}...`);
  
  // Compare results
  console.log('\n--- Comparison ---');
  console.log(`Full Planning Time: ${fullTime}ms`);
  console.log(`Iterative Planning Time: ${iterativeTime}ms`);
  console.log(`Time Difference: ${Math.abs(fullTime - iterativeTime)}ms (${fullTime > iterativeTime ? 'Iterative was faster' : 'Full was faster'})`);
  
  // Calculate similarity between results (very basic comparison)
  const similarity = calculateSimilarity(
    fullResult.choices[0].message.content,
    iterativeResult.choices[0].message.content
  );
  
  console.log(`Result Similarity: ${(similarity * 100).toFixed(2)}%`);
  
  // Provide analysis
  console.log('\n--- Analysis ---');
  if (taskName === 'Simple Task') {
    console.log('For simple tasks:');
    console.log('- Full planning is often more efficient as the entire plan can be determined upfront');
    console.log('- The overhead of iterative planning may not be justified for straightforward tasks');
  } else if (taskName === 'Complex Task') {
    console.log('For complex tasks:');
    console.log('- Full planning may struggle to anticipate all dependencies and steps needed');
    console.log('- Iterative planning can adapt as the task progresses, potentially leading to better results');
    console.log('- The time difference may be justified by the quality improvement');
  } else if (taskName === 'Adaptive Task') {
    console.log('For adaptive tasks:');
    console.log('- Iterative planning shines when the next steps depend heavily on previous results');
    console.log('- Full planning may make assumptions that turn out to be incorrect');
    console.log('- The ability to course-correct during execution is a major advantage of iterative planning');
  }
}

/**
 * Calculate a simple similarity score between two strings
 * This is a very basic implementation and not suitable for production use
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Convert to lowercase and remove punctuation
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '');
  
  const words1 = new Set(normalize(str1).split(/\s+/));
  const words2 = new Set(normalize(str2).split(/\s+/));
  
  // Count common words
  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      commonWords++;
    }
  }
  
  // Calculate Jaccard similarity
  const totalUniqueWords = new Set([...words1, ...words2]).size;
  return commonWords / totalUniqueWords;
}

// Run the example
main().catch(console.error);

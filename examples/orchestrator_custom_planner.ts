/**
 * Orchestrator Custom Planner Example
 * 
 * This example demonstrates how to use a custom planner with the Orchestrator workflow.
 */
import { 
  MCPApp, 
  Agent, 
  OpenAIAugmentedLLM,
  AnthropicAugmentedLLM,
  Orchestrator,
  Message,
  CompletionOptions,
  CompletionResult
} from '../src';

/**
 * Custom planner implementation that uses a more structured approach
 */
class CustomPlanner extends OpenAIAugmentedLLM {
  constructor(options: {
    agent: Agent;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    super({
      ...options,
      model: options.model || 'gpt-4o',
    });
  }
  
  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    // Add a system message to guide the planning process
    const enhancedMessages: Message[] = [
      {
        role: 'system',
        content: `You are an expert planner that breaks down complex tasks into well-structured steps.
        
        When creating a plan:
        1. First, analyze the task to understand all requirements
        2. Break it down into logical, sequential steps
        3. Identify dependencies between steps
        4. Assign the most appropriate agent to each step
        5. Ensure the plan is comprehensive and achievable
        
        Your plan should be detailed, clear, and optimized for efficiency.
        Always return your plan in valid JSON format.`
      },
      ...messages
    ];
    
    // Use a lower temperature for more deterministic planning
    const enhancedOptions: CompletionOptions = {
      ...options,
      temperature: 0.2,
    };
    
    // Call the parent implementation with enhanced messages and options
    return super.complete(enhancedMessages, enhancedOptions);
  }
}

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
 * Main function
 */
async function main() {
  // Create app
  const app = new MCPApp({
    name: 'orchestrator-custom-planner',
  });
  
  // Run the app
  await app.run(async (app) => {
    console.log('Creating agents...');
    
    // Create agents for different purposes
    const researchAgent = new Agent({
      name: 'researcher',
      instruction: 'You are a research agent that finds information.',
      functions: [getCurrentTime, getWeather],
      context: app.context,
    });
    
    const writerAgent = new Agent({
      name: 'writer',
      instruction: 'You are a writer agent that creates content.',
      context: app.context,
    });
    
    const editorAgent = new Agent({
      name: 'editor',
      instruction: 'You are an editor agent that reviews and improves content.',
      context: app.context,
    });
    
    const factCheckerAgent = new Agent({
      name: 'fact_checker',
      instruction: 'You are a fact checker agent that verifies information.',
      functions: [getCurrentTime, getWeather],
      context: app.context,
    });
    
    const summarizerAgent = new Agent({
      name: 'summarizer',
      instruction: 'You are a summarizer agent that condenses information.',
      context: app.context,
    });
    
    // Create a planner agent
    const plannerAgent = new Agent({
      name: 'planner',
      instruction: 'You are a planner agent that creates detailed, efficient plans.',
      context: app.context,
    });
    
    // Initialize all agents
    await Promise.all([
      researchAgent.initialize(),
      writerAgent.initialize(),
      editorAgent.initialize(),
      factCheckerAgent.initialize(),
      summarizerAgent.initialize(),
      plannerAgent.initialize(),
    ]);
    
    // Create LLM factory function
    const llmFactory = async (agent: Agent) => {
      if (agent.name === 'researcher' || agent.name === 'fact_checker') {
        return new OpenAIAugmentedLLM({
          agent,
          model: 'gpt-4o',
        });
      } else {
        return new AnthropicAugmentedLLM({
          agent,
          model: 'claude-3-opus-20240229',
        });
      }
    };
    
    // Create custom planner
    const customPlanner = new CustomPlanner({
      agent: plannerAgent,
    });
    
    // Define the task
    const task = 'Create a comprehensive travel guide for visiting Japan, including information about culture, transportation, food, and major attractions.';
    
    console.log('\n=== Running Orchestrator with Default Planner (Full Planning) ===');
    
    // Create orchestrator with default planner
    const orchestratorDefault = new Orchestrator({
      availableAgents: [
        researchAgent,
        writerAgent,
        editorAgent,
        factCheckerAgent,
        summarizerAgent,
      ],
      llmFactory,
      planType: 'full',
    });
    
    // Start time measurement for default planner
    const startTimeDefault = Date.now();
    
    // Run the orchestrator with default planner
    console.log('Running with default planner...');
    const resultDefault = await orchestratorDefault.complete([
      { role: 'user', content: task }
    ]);
    
    // End time measurement for default planner
    const endTimeDefault = Date.now();
    const executionTimeDefault = (endTimeDefault - startTimeDefault) / 1000; // Convert to seconds
    
    console.log(`Completed in ${executionTimeDefault.toFixed(2)} seconds`);
    console.log(`Result (excerpt): ${resultDefault.choices[0].message.content.substring(0, 150)}...`);
    
    console.log('\n=== Running Orchestrator with Custom Planner (Full Planning) ===');
    
    // Create orchestrator with custom planner
    const orchestratorCustom = new Orchestrator({
      availableAgents: [
        researchAgent,
        writerAgent,
        editorAgent,
        factCheckerAgent,
        summarizerAgent,
      ],
      llmFactory,
      planner: customPlanner,
      planType: 'full',
    });
    
    // Start time measurement for custom planner
    const startTimeCustom = Date.now();
    
    // Run the orchestrator with custom planner
    console.log('Running with custom planner...');
    const resultCustom = await orchestratorCustom.complete([
      { role: 'user', content: task }
    ]);
    
    // End time measurement for custom planner
    const endTimeCustom = Date.now();
    const executionTimeCustom = (endTimeCustom - startTimeCustom) / 1000; // Convert to seconds
    
    console.log(`Completed in ${executionTimeCustom.toFixed(2)} seconds`);
    console.log(`Result (excerpt): ${resultCustom.choices[0].message.content.substring(0, 150)}...`);
    
    console.log('\n=== Running Orchestrator with Custom Planner (Iterative Planning) ===');
    
    // Create orchestrator with custom planner and iterative planning
    const orchestratorCustomIterative = new Orchestrator({
      availableAgents: [
        researchAgent,
        writerAgent,
        editorAgent,
        factCheckerAgent,
        summarizerAgent,
      ],
      llmFactory,
      planner: customPlanner,
      planType: 'iterative',
    });
    
    // Start time measurement for custom planner with iterative planning
    const startTimeCustomIterative = Date.now();
    
    // Run the orchestrator with custom planner and iterative planning
    console.log('Running with custom planner and iterative planning...');
    const resultCustomIterative = await orchestratorCustomIterative.complete([
      { role: 'user', content: task }
    ]);
    
    // End time measurement for custom planner with iterative planning
    const endTimeCustomIterative = Date.now();
    const executionTimeCustomIterative = (endTimeCustomIterative - startTimeCustomIterative) / 1000; // Convert to seconds
    
    console.log(`Completed in ${executionTimeCustomIterative.toFixed(2)} seconds`);
    console.log(`Result (excerpt): ${resultCustomIterative.choices[0].message.content.substring(0, 150)}...`);
    
    console.log('\n=== Comparison ===');
    console.log(`Default Planner (Full Planning): ${executionTimeDefault.toFixed(2)} seconds`);
    console.log(`Custom Planner (Full Planning): ${executionTimeCustom.toFixed(2)} seconds`);
    console.log(`Custom Planner (Iterative Planning): ${executionTimeCustomIterative.toFixed(2)} seconds`);
    
    console.log('\n=== Benefits of Custom Planners ===');
    console.log('1. Specialized Planning: Can be optimized for specific types of tasks');
    console.log('2. Enhanced Instructions: Can include detailed guidance for creating better plans');
    console.log('3. Consistent Structure: Can enforce a consistent planning structure');
    console.log('4. Domain Knowledge: Can incorporate domain-specific knowledge into planning');
    console.log('5. Optimized Parameters: Can use optimized parameters for planning (e.g., lower temperature)');
    
    // Shutdown all agents
    await Promise.all([
      researchAgent.shutdown(),
      writerAgent.shutdown(),
      editorAgent.shutdown(),
      factCheckerAgent.shutdown(),
      summarizerAgent.shutdown(),
      plannerAgent.shutdown(),
    ]);
  });
}

// Run the example
main().catch(console.error);

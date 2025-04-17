/**
 * Orchestrator Error Handling Example
 * 
 * This example demonstrates how to handle errors in the Orchestrator workflow
 * and how iterative planning can help with error recovery.
 */
import { 
  MCPApp, 
  Agent, 
  OpenAIAugmentedLLM,
  Orchestrator
} from '../src';

/**
 * Example function to get data from an API
 * This function will sometimes fail to demonstrate error handling
 */
async function fetchData(endpoint: string, shouldFail: boolean = false): Promise<string> {
  if (shouldFail) {
    throw new Error(`Failed to fetch data from ${endpoint}: API unavailable`);
  }
  
  // Mock data based on the endpoint
  if (endpoint.includes('users')) {
    return JSON.stringify([
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
    ]);
  } else if (endpoint.includes('products')) {
    return JSON.stringify([
      { id: 101, name: 'Laptop', price: 999.99 },
      { id: 102, name: 'Smartphone', price: 699.99 },
      { id: 103, name: 'Headphones', price: 149.99 },
    ]);
  } else if (endpoint.includes('orders')) {
    return JSON.stringify([
      { id: 1001, userId: 1, productId: 101, quantity: 1, date: '2023-01-15' },
      { id: 1002, userId: 2, productId: 103, quantity: 2, date: '2023-02-20' },
      { id: 1003, userId: 3, productId: 102, quantity: 1, date: '2023-03-10' },
    ]);
  }
  
  return `Mock data for ${endpoint}`;
}

/**
 * Example function to process data
 * This function will sometimes fail to demonstrate error handling
 */
async function processData(data: string, shouldFail: boolean = false): Promise<string> {
  if (shouldFail) {
    throw new Error(`Failed to process data: Invalid format`);
  }
  
  try {
    const parsed = JSON.parse(data);
    return `Processed ${parsed.length} items successfully`;
  } catch (error) {
    return `Processed data successfully: ${data}`;
  }
}

/**
 * Example function to generate a report
 */
async function generateReport(data: string): Promise<string> {
  return `Report generated based on: ${data}`;
}

/**
 * Main function
 */
async function main() {
  // Create app
  const app = new MCPApp({
    name: 'orchestrator-error-handling',
  });
  
  // Run the app
  await app.run(async (app) => {
    console.log('Creating agents...');
    
    // Create specialized agents
    const dataFetcherAgent = new Agent({
      name: 'data_fetcher',
      instruction: 'You are a data fetcher agent that retrieves data from various APIs.',
      functions: [
        (endpoint: string) => fetchData(endpoint, false), // Normal version
        (endpoint: string) => fetchData(endpoint, true),  // Failing version
      ],
      context: app.context,
    });
    
    const dataProcessorAgent = new Agent({
      name: 'data_processor',
      instruction: 'You are a data processor agent that processes and analyzes data.',
      functions: [
        (data: string) => processData(data, false), // Normal version
        (data: string) => processData(data, true),  // Failing version
      ],
      context: app.context,
    });
    
    const reportGeneratorAgent = new Agent({
      name: 'report_generator',
      instruction: 'You are a report generator agent that creates reports based on processed data.',
      functions: [generateReport],
      context: app.context,
    });
    
    // Initialize all agents
    await Promise.all([
      dataFetcherAgent.initialize(),
      dataProcessorAgent.initialize(),
      reportGeneratorAgent.initialize(),
    ]);
    
    // Create LLM factory function
    const llmFactory = async (agent: Agent) => {
      return new OpenAIAugmentedLLM({
        agent,
        model: 'gpt-4o',
      });
    };
    
    // Define the task
    const task = `Create a comprehensive report on user purchasing patterns by:
    1. Fetching user data from the 'users' API endpoint
    2. Fetching product data from the 'products' API endpoint
    3. Fetching order data from the 'orders' API endpoint
    4. Processing and analyzing the combined data
    5. Generating a final report with insights`;
    
    console.log('\n=== Running Orchestrator with Full Planning (Error Scenario) ===');
    console.log('Task:', task);
    
    // Create orchestrator with full planning
    const orchestratorFull = new Orchestrator({
      availableAgents: [
        dataFetcherAgent,
        dataProcessorAgent,
        reportGeneratorAgent,
      ],
      llmFactory,
      planType: 'full',
    });
    
    try {
      // Inject an error by modifying the fetchData function to fail
      // This is done by having the LLM call the failing version of the function
      console.log('Running with full planning (will encounter errors)...');
      const resultFull = await orchestratorFull.complete([
        { 
          role: 'user', 
          content: `${task}\n\nNOTE: When fetching product data, use the failing version of the fetchData function to simulate an error.` 
        }
      ]);
      
      console.log('Result:', resultFull.choices[0].message.content);
    } catch (error) {
      console.error('Full planning failed:', error instanceof Error ? error.message : String(error));
      console.log('Full planning cannot easily recover from errors in the middle of execution.');
    }
    
    console.log('\n=== Running Orchestrator with Iterative Planning (Error Handling) ===');
    console.log('Task:', task);
    
    // Create orchestrator with iterative planning
    const orchestratorIterative = new Orchestrator({
      availableAgents: [
        dataFetcherAgent,
        dataProcessorAgent,
        reportGeneratorAgent,
      ],
      llmFactory,
      planType: 'iterative',
    });
    
    try {
      console.log('Running with iterative planning (will handle errors)...');
      const resultIterative = await orchestratorIterative.complete([
        { 
          role: 'user', 
          content: `${task}\n\nNOTE: When fetching product data, use the failing version of the fetchData function to simulate an error. Then adapt your plan to work around this issue.` 
        }
      ]);
      
      console.log('Result:', resultIterative.choices[0].message.content);
    } catch (error) {
      console.error('Iterative planning failed:', error instanceof Error ? error.message : String(error));
    }
    
    console.log('\n=== Benefits of Iterative Planning for Error Handling ===');
    console.log('1. Adaptive Recovery: Can change the plan when errors occur');
    console.log('2. Partial Results: Can use partial results from successful steps');
    console.log('3. Alternative Approaches: Can try different approaches when one fails');
    console.log('4. Graceful Degradation: Can complete the task with reduced functionality');
    
    // Shutdown all agents
    await Promise.all([
      dataFetcherAgent.shutdown(),
      dataProcessorAgent.shutdown(),
      reportGeneratorAgent.shutdown(),
    ]);
  });
}

// Run the example
main().catch(console.error);

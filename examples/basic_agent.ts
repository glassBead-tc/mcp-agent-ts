/**
 * Basic agent example
 */
import { MCPApp } from '../src/app';
import { Agent } from '../src/agents/agent';
import { AugmentedLLM, Message } from '../src/workflows/llm/augmented_llm';

// Mock LLM implementation for the example
class MockLLM extends AugmentedLLM {
  async complete(messages: Message[]): Promise<any> {
    return {
      id: 'mock-completion',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock response from the LLM.',
          },
          finish_reason: 'stop',
        },
      ],
    };
  }
  
  async completeWithTools(messages: Message[]): Promise<any> {
    return {
      id: 'mock-completion',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock response from the LLM.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'getCurrentTime',
                  arguments: '{}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
  }
}

// Example function to get current time
async function getCurrentTime(): Promise<string> {
  return new Date().toISOString();
}

// Main function
async function main() {
  // Create app
  const app = new MCPApp({
    name: 'basic-agent-example',
  });
  
  // Run the app
  await app.run(async (app) => {
    console.log('Creating agent...');
    
    // Create agent
    const agent = new Agent({
      name: 'basic-agent',
      instruction: 'You are a helpful agent that can get the current time.',
      functions: [getCurrentTime],
      context: app.context,
    });
    
    // Initialize agent
    await agent.initialize();
    
    // Create LLM
    const llm = await agent.attachLLM(async (agent) => {
      return new MockLLM({
        agent,
        model: 'mock-model',
      });
    });
    
    // Run conversation
    console.log('Running conversation...');
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a helpful agent that can get the current time.',
      },
      {
        role: 'user',
        content: 'What time is it?',
      },
    ];
    
    const result = await llm.runConversation(messages);
    
    // Print result
    console.log('\nConversation:');
    for (const message of result) {
      console.log(`${message.role}: ${message.content}`);
    }
    
    // Shutdown agent
    await agent.shutdown();
  });
}

// Run the example
main().catch(console.error);

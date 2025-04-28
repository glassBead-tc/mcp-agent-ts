/**
 * Tests for the Orchestrator workflow
 */
import { Agent } from '../../agents/agent.js';
import { AugmentedLLM, Message, CompletionOptions, CompletionResult } from '../llm/augmented_llm.js';
import { Orchestrator, PlanType } from './orchestrator.js';

// Mock AugmentedLLM class
class MockAugmentedLLM extends AugmentedLLM {
  private mockResponses: { [key: string]: string } = {};
  
  constructor(options: {
    agent: Agent;
    mockResponses?: { [key: string]: string };
  }) {
    super(options);
    
    if (options.mockResponses) {
      this.mockResponses = options.mockResponses;
    }
  }
  
  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const content = messages[0].content;
    
    // Check if we have a mock response for this content
    let response = 'Default mock response';
    
    for (const key in this.mockResponses) {
      if (content.includes(key)) {
        response = this.mockResponses[key];
        break;
      }
    }
    
    return {
      id: `mock-${Date.now()}`,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }
  
  async completeWithTools(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    return this.complete(messages, options);
  }
}

describe('Orchestrator', () => {
  // Test agents
  const researchAgent = new Agent({
    name: 'researcher',
    instruction: 'You are a researcher who finds information.',
  });
  
  const writerAgent = new Agent({
    name: 'writer',
    instruction: 'You are a writer who creates content.',
  });
  
  const editorAgent = new Agent({
    name: 'editor',
    instruction: 'You are an editor who reviews and improves content.',
  });
  
  // Mock LLM factory
  const mockLLMFactory = async (agent: Agent): Promise<AugmentedLLM> => {
    const mockResponses: { [key: string]: string } = {
      // Plan generation responses
      'create a plan': `{
        "steps": [
          {
            "id": "step1",
            "name": "Research",
            "description": "Research information about the topic",
            "agent": "researcher",
            "dependencies": []
          },
          {
            "id": "step2",
            "name": "Write",
            "description": "Write content based on research",
            "agent": "writer",
            "dependencies": ["step1"]
          },
          {
            "id": "step3",
            "name": "Edit",
            "description": "Edit and improve the content",
            "agent": "editor",
            "dependencies": ["step2"]
          }
        ]
      }`,
      
      // Step execution responses
      'researcher': 'Research results: Found information about the topic.',
      'writer': 'Written content: This is the content based on the research.',
      'editor': 'Edited content: This is the improved content.',
      
      // Summary generation response
      'summarizing': 'Final summary: The task was completed successfully.',
      
      // Iterative planning responses
      'next step': `{
        "description": "Research information",
        "tasks": [
          {
            "description": "Research information about the topic",
            "agent": "researcher"
          }
        ],
        "is_complete": false
      }`,
      
      'next step after research': `{
        "description": "Write content",
        "tasks": [
          {
            "description": "Write content based on research",
            "agent": "writer"
          }
        ],
        "is_complete": false
      }`,
      
      'next step after write': `{
        "description": "Edit content",
        "tasks": [
          {
            "description": "Edit and improve the content",
            "agent": "editor"
          }
        ],
        "is_complete": false
      }`,
      
      'next step after edit': `{
        "description": "Complete",
        "tasks": [],
        "is_complete": true
      }`
    };
    
    return new MockAugmentedLLM({
      agent,
      mockResponses,
    });
  };
  
  describe('Full planning mode', () => {
    it('should generate a plan, execute it, and generate a summary', async () => {
      // Create orchestrator
      const orchestrator = new Orchestrator({
        availableAgents: [researchAgent, writerAgent, editorAgent],
        llmFactory: mockLLMFactory,
        planType: 'full',
      });
      
      // Run orchestrator
      const result = await orchestrator.complete([
        { role: 'user', content: 'Write a blog post about AI.' }
      ]);
      
      // Check result
      expect(result.choices[0].message.content).toContain('Final summary');
    });
  });
  
  describe('Iterative planning mode', () => {
    it('should generate and execute steps iteratively', async () => {
      // Create orchestrator
      const orchestrator = new Orchestrator({
        availableAgents: [researchAgent, writerAgent, editorAgent],
        llmFactory: mockLLMFactory,
        planType: 'iterative',
      });
      
      // Run orchestrator
      const result = await orchestrator.complete([
        { role: 'user', content: 'Write a blog post about AI.' }
      ]);
      
      // Check result
      expect(result.choices[0].message.content).toContain('Final summary');
    });
  });
  
  describe('Error handling', () => {
    it('should handle errors in plan generation', async () => {
      // Create a mock LLM factory that returns invalid JSON
      const errorLLMFactory = async (agent: Agent): Promise<AugmentedLLM> => {
        const mockResponses: { [key: string]: string } = {
          'create a plan': 'This is not valid JSON',
        };
        
        return new MockAugmentedLLM({
          agent,
          mockResponses,
        });
      };
      
      // Create orchestrator
      const orchestrator = new Orchestrator({
        availableAgents: [researchAgent, writerAgent, editorAgent],
        llmFactory: errorLLMFactory,
      });
      
      // Run orchestrator and expect it to throw
      await expect(orchestrator.complete([
        { role: 'user', content: 'Write a blog post about AI.' }
      ])).rejects.toThrow();
    });
    
    it('should handle errors in step execution', async () => {
      // Create a mock LLM factory that throws an error during step execution
      const errorLLMFactory = async (agent: Agent): Promise<AugmentedLLM> => {
        const mockResponses: { [key: string]: string } = {
          'create a plan': `{
            "steps": [
              {
                "id": "step1",
                "name": "Research",
                "description": "Research information about the topic",
                "agent": "researcher",
                "dependencies": []
              }
            ]
          }`,
        };
        
        if (agent.name === 'researcher') {
          return {
            complete: async () => { throw new Error('Step execution error'); },
            completeWithTools: async () => { throw new Error('Step execution error'); },
          } as AugmentedLLM;
        }
        
        return new MockAugmentedLLM({
          agent,
          mockResponses,
        });
      };
      
      // Create orchestrator
      const orchestrator = new Orchestrator({
        availableAgents: [researchAgent, writerAgent, editorAgent],
        llmFactory: errorLLMFactory,
      });
      
      // Run orchestrator
      const result = await orchestrator.complete([
        { role: 'user', content: 'Write a blog post about AI.' }
      ]);
      
      // Check that the summary contains the error
      expect(result.choices[0].message.content).toContain('error');
    });
  });
});

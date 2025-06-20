/**
 * Tests for the LLMRouter class
 */
import { LLMRouter } from '../../../src/workflows/router/router_llm';
import { Agent } from '../../../src/agents/agent';
import { AugmentedLLM } from '../../../src/workflows/llm/augmented_llm';

// Mock the AugmentedLLM
const mockComplete = jest.fn();
const mockLLM = {
  complete: mockComplete,
} as unknown as AugmentedLLM;

// Mock the Agent
const mockAgent1 = {
  name: 'agent1',
  instruction: 'You are agent 1.',
} as unknown as Agent;

const mockAgent2 = {
  name: 'agent2',
  instruction: 'You are agent 2.',
} as unknown as Agent;

// Mock function
const mockFunction = jest.fn();
Object.defineProperty(mockFunction, 'name', { value: 'mockFunction' });
Object.defineProperty(mockFunction, 'description', {
  value: 'Mock function description',
});

describe('LLMRouter', () => {
  let router: LLMRouter;
  
  beforeEach(() => {
    mockComplete.mockReset();
    
    router = new LLMRouter({
      llm: mockLLM,
      agents: [mockAgent1, mockAgent2],
      functions: [mockFunction],
    });
  });
  
  test('should route to an agent', async () => {
    // Mock the LLM response
    mockComplete.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              choices: [
                {
                  name: 'agent1',
                  score: 0.9,
                  reasoning: 'This is the best agent for the job.',
                },
              ],
            }),
          },
        },
      ],
    });
    
    const results = await router.routeToAgent('Test request');
    
    expect(results).toHaveLength(1);
    expect(results[0].result).toBe(mockAgent1);
    expect(results[0].score).toBe(0.9);
    expect(results[0].metadata?.reasoning).toBe('This is the best agent for the job.');
    
    // Verify the LLM was called with the correct prompt
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[0][0][0].content).toContain('Test request');
    expect(mockComplete.mock.calls[0][0][0].content).toContain('agent1');
    expect(mockComplete.mock.calls[0][0][0].content).toContain('agent2');
  });
  
  test('should route to a function', async () => {
    // Mock the LLM response
    mockComplete.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              choices: [
                {
                  name: 'mockFunction',
                  score: 0.8,
                  reasoning: 'This is the best function for the job.',
                },
              ],
            }),
          },
        },
      ],
    });
    
    const results = await router.routeToFunction('Test request');
    
    expect(results).toHaveLength(1);
    expect(results[0].result).toBe(mockFunction);
    expect(results[0].score).toBe(0.8);
    expect(results[0].metadata?.reasoning).toBe('This is the best function for the job.');
    
    // Verify the LLM was called with the correct prompt
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[0][0][0].content).toContain('Test request');
    expect(mockComplete.mock.calls[0][0][0].content).toContain('mockFunction');
  });
  
  test('should route to either an agent or function', async () => {
    // Mock the LLM response
    mockComplete.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              choices: [
                {
                  name: 'agent2',
                  score: 0.95,
                  reasoning: 'This is the best choice for the job.',
                },
              ],
            }),
          },
        },
      ],
    });
    
    const results = await router.route('Test request');
    
    expect(results).toHaveLength(1);
    expect(results[0].result).toBe(mockAgent2);
    expect(results[0].score).toBe(0.95);
    expect(results[0].metadata?.reasoning).toBe('This is the best choice for the job.');
    expect(results[0].metadata?.type).toBe('agent');
    
    // Verify the LLM was called with the correct prompt
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[0][0][0].content).toContain('Test request');
    expect(mockComplete.mock.calls[0][0][0].content).toContain('agent1');
    expect(mockComplete.mock.calls[0][0][0].content).toContain('agent2');
    expect(mockComplete.mock.calls[0][0][0].content).toContain('mockFunction');
  });
});

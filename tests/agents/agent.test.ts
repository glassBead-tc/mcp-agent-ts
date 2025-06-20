/**
 * Tests for the Agent class
 */
import { Agent } from '../../src/agents/agent';
import { Context } from '../../src/context';
import { MCPAggregator } from '../../src/mcp/mcp_aggregator';

// Spy on MCPAggregator methods to avoid real network calls
jest
  .spyOn(MCPAggregator.prototype, 'initialize')
  .mockImplementation(function () {
    (this as any).initialized = true;
    return Promise.resolve();
  });
jest.spyOn(MCPAggregator.prototype, 'listTools').mockResolvedValue({ tools: [] });
jest
  .spyOn(MCPAggregator.prototype, 'callTool')
  .mockResolvedValue({ content: [{ type: 'text', text: 'Mock tool result' }] });
jest.spyOn(MCPAggregator.prototype, 'close').mockResolvedValue(undefined);

describe('Agent', () => {
  let agent: Agent;
  let context: Context;
  
  beforeEach(() => {
    context = new Context();
    agent = new Agent({
      name: 'test-agent',
      instruction: 'You are a test agent.',
      context,
    });
  });
  
  afterEach(async () => {
    await agent.shutdown();
  });
  
  test('should create an agent with the correct properties', () => {
    expect(agent.name).toBe('test-agent');
    expect(agent.instruction).toBe('You are a test agent.');
  });
  
  test('should initialize the agent', async () => {
    await agent.initialize();
    expect(agent.initialized).toBe(true);
  });
  
  test('should list tools', async () => {
    await agent.initialize();
    const result = await agent.listTools();
    expect(result).toEqual({ tools: [] });
  });
  
  test('should call a tool', async () => {
    await agent.initialize();
    const result = await agent.callTool('test-tool');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Mock tool result' }],
    });
  });
  
  test('should handle function tools', async () => {
    const testFunction = jest.fn().mockResolvedValue('Test function result');
    
    const functionAgent = new Agent({
      name: 'function-agent',
      instruction: 'You are a function agent.',
      functions: [testFunction],
      context,
    });
    
    await functionAgent.initialize();
    
    // Mock the function tool map
    (functionAgent as any).functionToolMap.set('testFunction', {
      name: 'testFunction',
      description: 'Test function',
      parameters: {},
      run: testFunction,
    });
    
    const result = await functionAgent.callTool('testFunction');
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Test function result' }],
    });
    
    await functionAgent.shutdown();
  });
});

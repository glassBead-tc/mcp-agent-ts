/**
 * Tests for the AnthropicAugmentedLLM class
 */
import { AnthropicAugmentedLLM, RequestParams } from '../../../src/workflows/llm/augmented_llm_anthropic.js';

// Define types for Anthropic SDK objects
interface Message {
  role: string;
  content: any[];
  model: string;
  stop_reason: string;
  id: string;
  type: string;
  usage: Usage;
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, any>;
  id: string;
}

interface Usage {
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  input_tokens: number;
  output_tokens: number;
}

describe('AnthropicAugmentedLLM', () => {
  /**
   * Creates a mock LLM instance with common mocks set up
   */
  function createMockLLM() {
    // Setup mock objects
    const mockContext = {
      config: {
        anthropic: {
          default_model: 'claude-3-7-sonnet-latest',
          api_key: 'test_key'
        }
      }
    } as any;

    // Create LLM instance
    const llm = new AnthropicAugmentedLLM({
      name: 'test', 
      context: mockContext
    });

    // Setup common mocks
    llm.aggregator = {
      listTools: jest.fn().mockResolvedValue({ tools: [] })
    } as any;
    
    llm.history = {
      get: jest.fn().mockReturnValue([]),
      set: jest.fn()
    } as any;
    
    llm.selectModel = jest.fn().mockResolvedValue('claude-3-7-sonnet-latest');
    llm._logChatProgress = jest.fn();
    llm._logChatFinished = jest.fn();

    // Provide a generate method for backwards compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (llm as any).generate = (input: string, params: any) =>
      llm.completeWithTools([{ role: 'user', content: input }], params);

    return llm;
  }

  /**
   * Default usage object for testing
   */
  const defaultUsage: Usage = {
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    input_tokens: 2789,
    output_tokens: 89
  };

  /**
   * Creates a tool use message for testing
   */
  function createToolUseMessage(callCount: number, usage: Usage): Message {
    return {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          name: 'search_tool',
          input: { query: 'test query' },
          id: `tool_${callCount}`
        } as ToolUseBlock
      ],
      model: 'claude-3-7-sonnet-latest',
      stop_reason: 'tool_use',
      id: `resp_${callCount}`,
      type: 'message',
      usage
    };
  }

  /**
   * Creates a text message for testing
   */
  function createTextMessage(text: string, usage: Usage, role: string = 'assistant'): Message {
    return {
      role,
      content: [
        {
          type: 'text',
          text
        } as TextBlock
      ],
      model: 'claude-3-7-sonnet-latest',
      stop_reason: 'end_turn',
      id: 'final_response',
      type: 'message',
      usage
    };
  }

  /**
   * Checks if there's a final iteration prompt in the given messages
   */
  function checkFinalIterationPromptInMessages(messages: any[]): boolean {
    for (const msg of messages) {
      if (
        msg?.role === 'user' &&
        typeof msg?.content === 'string' &&
        msg.content.toLowerCase().includes('please stop using tools')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Creates a side effect function for tool use testing
   */
  function createToolUseSideEffect(maxIterations: number, defaultUsage: Usage) {
    let callCount = 0;

    return async function sideEffect(_fn: any, kwargs: any) {
      callCount += 1;

      const messages = kwargs.messages || [];
      const hasFinalIterationPrompt = checkFinalIterationPromptInMessages(messages);

      if (hasFinalIterationPrompt) {
        return [
          createTextMessage(
            'Here is my final answer based on all the tool results gathered so far...',
            defaultUsage
          )
        ];
      } else {
        return [createToolUseMessage(callCount, defaultUsage)];
      }
    };
  }

  test('should return final response after max iterations with tool use', async () => {
    // Setup LLM
    const mockLLM = createMockLLM();
    
    // Setup executor with side effect
    mockLLM.executor = {
      execute: jest.fn().mockImplementation(
        createToolUseSideEffect(3, defaultUsage)
      )
    } as any;
    
    // Setup tool call mock
    mockLLM.callTool = jest.fn().mockResolvedValue({
      content: 'Tool result',
      isError: false
    });
    
    // Call LLM with max_iterations=3
    const requestParams: RequestParams = {
      model: 'claude-3-7-sonnet-latest',
      maxTokens: 1000,
      max_iterations: 3,
      use_history: true
    };
    
    const result = await mockLLM.completeWithTools([
      { role: 'user', content: 'Test query' },
    ], requestParams);

    expect(result).toHaveProperty('choices');
  });
});
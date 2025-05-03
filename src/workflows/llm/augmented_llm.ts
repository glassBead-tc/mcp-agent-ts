/**
 * Augmented LLM base class for MCP Agent
 */
import { Agent } from "../../agents/agent.js";
import { getLogger } from "../../logging/logger.js";
import { MCPClient } from "@modelcontextprotocol/sdk";
import { Workflow, WorkflowOptions } from "../../executor/workflow.js";
import { ModelSelector } from "./model_selector.js";
import { requestHumanInput } from "../../human_input/handler.js";

const logger = getLogger("augmented_llm");

/**
 * Message interface
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

/**
 * Completion options
 */
export interface CompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  tools?: any[];
  tool_choice?: "auto" | "none" | { type: string; function: { name: string } };
  [key: string]: any;
}

/**
 * Completion result
 */
export interface CompletionResult {
  id: string;
  choices: {
    index: number;
    message: Message;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AugmentedLLM input interface
 */
export interface AugmentedLLMInput {
  message: string;
  conversationId?: string;
  modelName?: string;
  tools?: any[];
  humanFallback?: boolean;
}

/**
 * AugmentedLLM output interface
 */
export interface AugmentedLLMOutput {
  response: string;
  conversationId: string;
  modelUsed: string;
  usedTools: string[];
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  metadata: Record<string, any>;
}

/**
 * AugmentedLLM options interface
 */
export interface AugmentedLLMOptions extends WorkflowOptions {
  mcpClient: MCPClient;
  modelSelector?: ModelSelector;
  defaultModel?: string;
  humanFallbackEnabled?: boolean;
}

/**
 * Base class for augmented LLMs
 */
export abstract class AugmentedLLM {
  protected agent: Agent;
  protected model: string;
  protected apiKey?: string;
  protected baseUrl?: string;
  protected options: Record<string, any>;

  constructor(options: {
    agent: Agent;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    this.agent = options.agent;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.options = options.options || {};
  }

  /**
   * Complete a conversation
   */
  abstract complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  /**
   * Complete a conversation with tool calling
   */
  abstract completeWithTools(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  /**
   * Run a conversation with tool calling
   */
  async runConversation(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<Message[]> {
    logger.debug("Running conversation", { messages });

    const allMessages = [...messages];
    let lastMessage = allMessages[allMessages.length - 1];

    // Get available tools
    const toolsResult = await this.agent.listTools();
    const tools = toolsResult.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    // Run the conversation
    while (true) {
      // Complete with tools
      const completion = await this.completeWithTools(allMessages, {
        ...options,
        tools,
      });

      const assistantMessage = completion.choices[0].message;
      allMessages.push(assistantMessage);

      // Check if there are tool calls
      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        break;
      }

      // Process tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        logger.debug(`Calling tool ${toolName}`, { args: toolArgs });

        try {
          // Call the tool
          const result = await this.agent.callTool(toolName, toolArgs);

          // Add tool message
          const toolMessage: Message = {
            role: "tool",
            content: result.isError
              ? `Error: ${result.content[0].text}`
              : result.content[0].text,
            tool_call_id: toolCall.id,
          };

          allMessages.push(toolMessage);
        } catch (error) {
          logger.error(`Error calling tool ${toolName}`, { error });

          // Add error message
          const errorMessage: Message = {
            role: "tool",
            content: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
            tool_call_id: toolCall.id,
          };

          allMessages.push(errorMessage);
        }
      }
    }

    return allMessages;
  }

  /**
   * Get the instruction for the agent
   */
  protected getInstruction(): string {
    const instruction = this.agent.instruction;

    if (typeof instruction === "function") {
      return instruction({});
    }

    return instruction;
  }
}

/**
 * AugmentedLLM workflow
 * Combines LLM capabilities with MCP server tools
 */
export class AugmentedLLMWorkflow extends Workflow<
  AugmentedLLMInput,
  AugmentedLLMOutput
> {
  private mcpClient: MCPClient;
  private modelSelector?: ModelSelector;
  private defaultModel: string;
  private humanFallbackEnabled: boolean;

  constructor(options: AugmentedLLMOptions) {
    super({
      name: "AugmentedLLM",
      description: "A workflow that combines LLMs with MCP server tools",
      ...options,
    });

    this.mcpClient = options.mcpClient;
    this.modelSelector = options.modelSelector;
    this.defaultModel = options.defaultModel || "openai/gpt-4o";
    this.humanFallbackEnabled = options.humanFallbackEnabled ?? true;
  }

  /**
   * Run the AugmentedLLM workflow
   * @param input Workflow input
   * @returns Workflow output
   */
  protected async run(input: AugmentedLLMInput): Promise<AugmentedLLMOutput> {
    this.logger.info("Running AugmentedLLM workflow", {
      conversationId: input.conversationId,
      modelName: input.modelName,
    });

    // Generate a conversation ID if not provided
    const conversationId =
      input.conversationId ||
      `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      // Get available tools from MCP server
      const tools = await this.mcpClient.listTools();
      this.logger.debug("Available tools", { toolCount: tools.length });

      // Determine which model to use
      let modelName = input.modelName || this.defaultModel;
      if (!input.modelName && this.modelSelector) {
        const model = this.modelSelector.selectModel("general-purpose");
        modelName = `${model.provider}/${model.model}`;
      }

      // Generate response with tools
      const result = await this.mcpClient.generate({
        messages: [{ role: "user", content: input.message }],
        tools: tools,
        model: modelName,
      });

      const usedTools: string[] = [];

      // If the response used tools, record them
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          usedTools.push(toolCall.name);
        }
      }

      return {
        response: result.content || "",
        conversationId,
        modelUsed: modelName,
        usedTools,
        tokens: {
          input: result.usage?.prompt_tokens || 0,
          output: result.usage?.completion_tokens || 0,
          total: result.usage?.total_tokens || 0,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error("Error in AugmentedLLM workflow", { error });

      // Handle error with human fallback if enabled
      if (input.humanFallback && this.humanFallbackEnabled) {
        this.logger.info("Falling back to human input");
        const humanResponse = await requestHumanInput(
          `LLM processing failed. Please provide a response to: ${input.message}`
        );

        return {
          response: humanResponse,
          conversationId,
          modelUsed: "human",
          usedTools: [],
          tokens: {
            input: 0,
            output: 0,
            total: 0,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            isHumanFallback: true,
          },
        };
      }

      throw error;
    }
  }

  /**
   * Generate a string response (convenience method)
   * @param message User message
   * @param options Additional options
   * @returns Response string
   */
  async generateStr(
    message: string,
    options: Omit<AugmentedLLMInput, "message"> = {}
  ): Promise<string> {
    const result = await this.execute({
      message,
      ...options,
    });

    return result.response;
  }
}

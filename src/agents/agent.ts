/**
 * Agent implementation for MCP Agent
 *
 * An Agent is an entity that has access to a set of MCP servers and can interact with them.
 * Each agent has a name and purpose defined by its instruction.
 */
import { v4 as uuidv4 } from "uuid";
import { Tool } from "@modelcontextprotocol/sdk/types";
import { MCPAggregator } from "../mcp/mcp_aggregator.js";
import { Context } from "../context.js";
import { getLogger } from "../logging/logger.js";
import {
  HumanInputCallback,
  HumanInputRequest,
  HumanInputResponse,
  HUMAN_INPUT_SIGNAL_NAME,
  HUMAN_INPUT_TOOL_NAME,
} from "../types.js";

const logger = getLogger("agent");

/**
 * Function tool interface
 *
 * Represents a function that can be called as a tool by the agent.
 * @interface
 */
export interface FunctionTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  run: (args: Record<string, any>) => Promise<any>;
}

/**
 * Agent class for MCP Agent
 *
 * An Agent is an entity that has access to a set of MCP servers and exposes them to an LLM as tool calls.
 * It can also expose regular functions as tools and handle human input requests.
 *
 * @extends MCPAggregator
 */
export class Agent extends MCPAggregator {
  name: string;
  instruction: string | ((context: Record<string, any>) => string);
  functions: Function[];
  private functionToolMap: Map<string, FunctionTool> = new Map();
  humanInputCallback?: HumanInputCallback;

  /**
   * Create a new agent
   *
   * @param options - Agent options
   * @param options.name - The name of the agent
   * @param options.instruction - The instruction for the agent (can be a string or a function that returns a string)
   * @param options.serverNames - List of MCP server names to connect to
   * @param options.functions - List of functions to expose as tools
   * @param options.connectionPersistence - Whether to keep connections to MCP servers open
   * @param options.humanInputCallback - Callback for handling human input requests
   * @param options.context - The context to use
   */
  constructor(options: {
    name: string;
    instruction?: string | ((context: Record<string, any>) => string);
    serverNames?: string[];
    functions?: Function[];
    connectionPersistence?: boolean;
    humanInputCallback?: HumanInputCallback;
    context?: Context;
  }) {
    super(
      options.context || new Context(),
      options.serverNames || [],
      options.connectionPersistence !== undefined
        ? options.connectionPersistence
        : true
    );

    this.name = options.name;
    this.instruction = options.instruction || "You are a helpful agent.";
    this.functions = options.functions || [];

    // Set human input callback
    this.humanInputCallback = options.humanInputCallback;
    if (!this.humanInputCallback && this.context.humanInputHandler) {
      this.humanInputCallback = this.context.humanInputHandler;
    }
  }

  /**
   * Initialize the agent
   *
   * This method initializes the connection manager and registers function tools.
   * It should be called before using the agent.
   *
   * @returns A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Initialize connection manager
    await super.initialize();

    // Register function tools
    for (const fn of this.functions) {
      const tool = this.createFunctionTool(fn);
      this.functionToolMap.set(tool.name, tool);
    }
  }

  /**
   * Create a function tool from a function
   *
   * @param fn - The function to convert to a tool
   * @returns The function tool
   * @private
   */
  private createFunctionTool(fn: Function): FunctionTool {
    // Get function name and description
    const name = fn.name;
    const description = fn.description || `Function ${name}`;

    // Get function parameters
    // This is a simplified version - in a real implementation, we would
    // use reflection or decorators to get parameter information
    const parameters = {
      type: "object",
      properties: {},
      required: [],
    };

    // Create tool
    return {
      name,
      description,
      parameters,
      run: async (args: Record<string, any>) => {
        try {
          return await fn(args);
        } catch (error) {
          logger.error(`Error running function ${name}`, { error });
          throw error;
        }
      },
    };
  }

  /**
   * Attach an LLM to the agent
   *
   * @param llmFactory - Factory function that creates an LLM for this agent
   * @returns The created LLM
   * @template T - The type of LLM to create
   */
  async attachLLM<T>(llmFactory: (agent: Agent) => Promise<T>): Promise<T> {
    return llmFactory(this);
  }

  /**
   * Shutdown the agent
   *
   * This method closes all connections to MCP servers.
   * It should be called when the agent is no longer needed.
   *
   * @returns A promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    await this.close();
  }

  /**
   * Request input from a human user
   *
   * This method pauses the workflow until input is received from a human.
   *
   * @param request - The human input request
   * @returns A promise that resolves with the human input response
   * @throws Error if no human input callback is set
   */
  async requestHumanInput(
    request: HumanInputRequest
  ): Promise<HumanInputResponse> {
    if (!this.humanInputCallback) {
      throw new Error("Human input callback not set");
    }

    // Generate a unique ID for this request
    const requestId = `${HUMAN_INPUT_SIGNAL_NAME}_${this.name}_${uuidv4()}`;
    request.request_id = requestId;

    logger.debug("Requesting human input", { request });

    // Call the callback and signal
    const callbackPromise = (async () => {
      try {
        const userInput = await this.humanInputCallback!(request);
        logger.debug("Received human input", { userInput });

        if (this.context.executor) {
          await this.context.executor.signal(requestId, userInput);
        }

        return userInput;
      } catch (error) {
        logger.error("Error getting human input", { error });

        if (this.context.executor) {
          await this.context.executor.signal(requestId, {
            text: `Error getting human input: ${
              error instanceof Error ? error.message : String(error)
            }`,
            metadata: { error: true },
          });
        }

        throw error;
      }
    })();

    // Start the callback in the background
    callbackPromise.catch((error) => {
      logger.error("Error in human input callback", { error });
    });

    logger.debug("Waiting for human input signal");

    // Wait for signal
    const result =
      await this.context.executor!.waitForSignal<HumanInputResponse>(
        requestId,
        {
          requestId,
          workflowId: request.workflow_id || "",
          signalDescription: request.description || request.prompt,
          timeout_seconds: request.timeout_seconds,
        }
      );

    logger.debug("Received human input signal", { result });
    return result;
  }

  /**
   * List tools from all sources
   *
   * This method returns a list of all tools available to the agent,
   * including tools from MCP servers, function tools, and the human input tool.
   *
   * @returns A promise that resolves with the list of tools
   */
  async listTools(): Promise<{ tools: Tool[] }> {
    // If not initialized, initialize first
    if (!this.initialized) {
      await this.initialize();
    }

    // Get tools from MCP servers
    const result = await super.listTools();

    // Add function tools
    for (const tool of this.functionToolMap.values()) {
      result.tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      });
    }

    // Add human input tool if callback is set
    if (this.humanInputCallback) {
      result.tools.push({
        name: HUMAN_INPUT_TOOL_NAME,
        description: "Request input from a human user",
        inputSchema: {
          type: "object",
          properties: {
            request: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "The prompt to show to the human",
                },
                description: {
                  type: "string",
                  description: "Optional description of what the input is for",
                },
                timeout_seconds: {
                  type: "number",
                  description: "Timeout in seconds",
                },
                workflow_id: {
                  type: "string",
                  description: "ID of the workflow making the request",
                },
              },
              required: ["prompt"],
            },
          },
          required: ["request"],
        },
      });
    }

    return result;
  }

  /**
   * Call a tool
   *
   * This method calls a tool by name with the given arguments.
   * The tool can be from an MCP server, a function tool, or the human input tool.
   *
   * @param name - The name of the tool to call
   * @param arguments_ - The arguments to pass to the tool
   * @returns A promise that resolves with the result of the tool call
   */
  async callTool(
    name: string,
    arguments_: Record<string, any> | null = null
  ): Promise<{
    isError?: boolean;
    content: { type: string; text: string }[];
  }> {
    // Handle human input tool
    if (name === HUMAN_INPUT_TOOL_NAME) {
      return this.callHumanInputTool(arguments_);
    }

    // Handle function tools
    if (this.functionToolMap.has(name)) {
      const tool = this.functionToolMap.get(name)!;
      try {
        const result = await tool.run(arguments_ || {});
        return {
          content: [
            {
              type: "text",
              text:
                typeof result === "string" ? result : JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error calling function tool ${name}`, { error });
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error calling function ${name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }

    // Handle MCP server tools
    return super.callTool(name, arguments_);
  }

  /**
   * Call the human input tool
   *
   * This method handles calls to the human input tool.
   *
   * @param arguments_ - The arguments for the human input tool
   * @returns A promise that resolves with the result of the tool call
   * @private
   */
  private async callHumanInputTool(
    arguments_: Record<string, any> | null = null
  ): Promise<{
    isError?: boolean;
    content: { type: string; text: string }[];
  }> {
    try {
      if (!arguments_ || !arguments_.request) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Error: Missing request parameter",
            },
          ],
        };
      }

      const request: HumanInputRequest = arguments_.request;
      const result = await this.requestHumanInput(request);

      return {
        content: [
          {
            type: "text",
            text: `Human response: ${JSON.stringify(result)}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Timeout")) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Human input request timed out: ${error.message}`,
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error requesting human input: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
}

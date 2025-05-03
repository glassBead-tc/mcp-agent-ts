/**
 * Agent implementation for MCP Agent
 *
 * An Agent is an entity that has access to a set of MCP servers and can interact with them.
 * Each agent has a name and purpose defined by its instruction.
 */
import { v4 as uuidv4 } from "uuid";
import { Tool } from "@modelcontextprotocol/sdk/types";
import { MCPAggregator } from "../mcp/mcp_aggregator";
import { Context } from "../context";
import { getLogger } from "../logging/logger";
import {
  HumanInputCallback,
  HumanInputRequest,
  HumanInputResponse,
  HUMAN_INPUT_SIGNAL_NAME,
  HUMAN_INPUT_TOOL_NAME,
} from "../types";
import { MCPClient } from "@modelcontextprotocol/sdk";
import { MCPConnectionManager } from "../mcp/mcp_connection_manager.js";

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
  private mcpClients: Map<string, MCPClient> = new Map();
  private tools: Tool[] = [];
  private initialized = false;

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
  async initialize(connectionManager: MCPConnectionManager): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info(`Initializing agent: ${this.name}`);

    try {
      // Connect to all MCP servers
      for (const serverName of this.serverNames) {
        const client = await connectionManager.getServer(serverName);
        this.mcpClients.set(serverName, client);
      }

      // Load tools from all servers
      await this.loadTools();

      // Add human input tool if callback provided
      if (this.humanInputCallback) {
        this.addHumanInputTool();
      }

      this.initialized = true;
      logger.info(`Agent initialized: ${this.name}`);
    } catch (error) {
      logger.error(`Failed to initialize agent: ${this.name}`, { error });
      throw error;
    }
  }

  /**
   * Load tools from all MCP servers
   */
  private async loadTools(): Promise<void> {
    const toolsPromises = Array.from(this.mcpClients.entries()).map(
      async ([serverName, client]) => {
        try {
          const tools = await client.listTools();

          // Add server name prefix to tool names to avoid conflicts
          const prefixedTools = tools.map((tool) => ({
            ...tool,
            name: `${serverName}-${tool.name}`,
          }));

          return prefixedTools;
        } catch (error) {
          logger.error(`Failed to list tools for server: ${serverName}`, {
            error,
          });
          return [];
        }
      }
    );

    const toolsArrays = await Promise.all(toolsPromises);
    this.tools = toolsArrays.flat();

    logger.debug(`Loaded ${this.tools.length} tools for agent: ${this.name}`);
  }

  /**
   * Add a human input tool
   */
  private addHumanInputTool(): void {
    this.tools.push({
      name: "__human_input__",
      description: "Request input from a human user",
      parameters: {
        prompt: {
          type: "string",
          description: "The prompt to show to the human",
        },
      },
      returns: {
        response: {
          type: "string",
          description: "The response from the human",
        },
      },
    });
  }

  /**
   * Get the agent's name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the agent's instruction
   */
  getInstruction(): string {
    return this.instruction;
  }

  /**
   * Get the agent's server names
   */
  getServerNames(): string[] {
    return this.serverNames;
  }

  /**
   * Get all tools available to the agent
   */
  getTools(): Tool[] {
    return this.tools;
  }

  /**
   * Call a tool on an MCP server
   * @param toolName Tool name
   * @param args Tool arguments
   * @returns Tool result
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    // Handle human input tool
    if (toolName === "__human_input__" && this.humanInputCallback) {
      return this.humanInputCallback(args.prompt);
    }

    // Parse server and tool name
    const [serverName, actualToolName] = toolName.split("-");

    const client = this.mcpClients.get(serverName);
    if (!client) {
      throw new Error(`No MCP client for server: ${serverName}`);
    }

    try {
      // Call the tool on the MCP server
      const result = await client.callTool(actualToolName, args);
      return result;
    } catch (error) {
      logger.error(`Error calling tool ${toolName}`, { error, args });
      throw error;
    }
  }

  /**
   * Attach an LLM to this agent
   * @param llmFactory LLM factory
   * @param opts LLM options
   * @returns LLM instance
   */
  async attachLLM<T>(
    llmFactory: (agent: Agent, opts?: any) => Promise<T>,
    opts?: any
  ): Promise<T> {
    // Create LLM instance
    const llm = await llmFactory(this, opts);
    return llm;
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
      await this.initialize(this.context.mcpConnectionManager);
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
}

import {
  ClientSession,
  StdioServerParameters,
} from "@modelcontextprotocol/sdk";
import { createStdioClient } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as readline from "readline";
import * as path from "path";
import { MCPApp } from "../../src/app";
import { Agent } from "../../src/agents/agent";
import { OpenAIAugmentedLLM } from "../../src/workflows/llm/augmented_llm_openai";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

class MCPClient {
  private session: ClientSession | null = null;
  private stdio: any;
  private write: any;
  private app: MCPApp | null = null;
  private agent: Agent | null = null;
  private llm: OpenAIAugmentedLLM | null = null;
  private rl: readline.Interface | null = null;

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    this.app = new MCPApp({ name: "mcp_agent" });
    await this.app.initialize();

    this.agent = new Agent({
      name: "agent",
      instruction: "you are an assistant",
      serverNames: ["mcp_agent"],
      context: this.app.context,
    });
    await this.agent.initialize();

    this.llm = await this.agent.attachLLM(async (agent) => {
      return new OpenAIAugmentedLLM({
        agent,
        model: this.app.context.config.openai?.default_model || "gpt-4o",
        apiKey: this.app.context.config.openai?.api_key,
        baseUrl: this.app.context.config.openai?.base_url,
      });
    });

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Connect to an MCP server
   *
   * @param serverScriptPath - Path to the server script (.ts, .js, or .py)
   */
  async connectToServer(serverScriptPath: string): Promise<void> {
    const ext = path.extname(serverScriptPath);
    let command: string;
    let args: string[] = [serverScriptPath];

    if (ext === ".py") {
      // Python script
      command = "python";
    } else if (ext === ".ts") {
      // TypeScript script
      command = "npx";
      args = ["tsx", serverScriptPath];
    } else if (ext === ".js") {
      // JavaScript script
      command = "node";
    } else {
      throw new Error("Server script must be a .py, .ts, or .js file");
    }

    const serverParams = new StdioServerParameters({
      command,
      args,
      env: null,
    });

    const { readStream, writeStream } = await createStdioClient(serverParams);
    this.stdio = readStream;
    this.write = writeStream;
    this.session = new ClientSession(this.stdio, this.write);

    await this.session.initialize();

    // List available tools
    const response = await this.session.listTools();
    const tools = response.tools;
    console.log(
      "\nConnected to server with tools:",
      tools.map((tool) => tool.name)
    );
  }

  /**
   * Process a query
   *
   * @param query - The query to process
   * @returns The response
   */
  async processQuery(query: string): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const result = await this.llm.runConversation([
      { role: "user", content: query },
    ]);

    return result[result.length - 1].content;
  }

  /**
   * Run an interactive chat loop
   */
  async chatLoop(): Promise<void> {
    if (!this.rl) {
      throw new Error("Readline interface not initialized");
    }

    console.log("\nMCP Client Started!");
    console.log("Type your queries or 'quit' to exit.");

    const askQuestion = () => {
      return new Promise<string>((resolve) => {
        this.rl!.question("\nQuery: ", (answer) => {
          resolve(answer.trim());
        });
      });
    };

    while (true) {
      try {
        const query = await askQuestion();

        if (query.toLowerCase() === "quit") {
          break;
        }

        const response = await this.processQuery(query);
        console.log("\n" + response);
      } catch (error) {
        console.error(
          "\nError:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Close readline interface
    if (this.rl) {
      this.rl.close();
    }

    // Close session
    if (this.session) {
      await this.session.dispose();
    }

    // Shutdown agent
    if (this.agent) {
      await this.agent.shutdown();
    }

    // Shutdown app
    if (this.app) {
      await this.app.shutdown();
    }
  }
}

// Main function
async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: npx tsx client.ts <path_to_server_script>");
    process.exit(1);
  }

  const serverScriptPath = process.argv[2];
  const client = new MCPClient();

  try {
    await client.initialize();
    await client.connectToServer(serverScriptPath);
    await client.chatLoop();
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    await client.cleanup();
  }
}

// Start the client
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

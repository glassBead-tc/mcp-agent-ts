/**
 * MCP Connection Manager
 * Manages connections to MCP servers
 */
import { getLogger } from "../logging/logger.js";
import { ServerRegistry } from "./server_registry.js";
import { spawn, ChildProcess } from "child_process";
// Import or mock MCPClient - using a simple interface for now
// Will need to install @modelcontextprotocol/sdk if it's available
interface MCPClient {
  baseUrl: string;
  // Add other properties/methods as needed
}

const logger = getLogger("mcp-connection-manager");

/**
 * Interface for a managed MCP server process
 */
interface ManagedMCPServer {
  name: string;
  process: ChildProcess;
  client?: MCPClient;
  url?: string;
  status: "starting" | "running" | "stopping" | "stopped" | "error";
  error?: Error;
}

/**
 * MCP Connection Manager
 * Manages connections to MCP servers
 */
export class MCPConnectionManager {
  private registry: ServerRegistry;
  private servers: Map<string, ManagedMCPServer> = new Map();
  private clients: Map<string, MCPClient> = new Map();

  /**
   * Create a new MCP connection manager
   * @param registry Server registry
   */
  constructor(registry: ServerRegistry) {
    this.registry = registry;
    logger.debug("MCP connection manager created");
  }

  /**
   * Start an MCP server
   * @param name Server name
   * @returns Promise that resolves when the server is started
   */
  async startServer(name: string): Promise<void> {
    // Check if server is already running
    if (this.servers.has(name)) {
      logger.debug(`Server already running: ${name}`);
      return;
    }

    // Get server configuration
    const config = this.registry.getServer(name);
    if (!config) {
      throw new Error(`Server not found in registry: ${name}`);
    }

    logger.info(`Starting MCP server: ${name}`, {
      command: config.command,
      args: config.args,
    });

    try {
      // Spawn server process
      const serverProcess = spawn(config.command, config.args || [], {
        env: {
          ...process.env,
          ...config.env,
        },
        cwd: config.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Create managed server entry
      const server: ManagedMCPServer = {
        name,
        process: serverProcess,
        status: "starting",
      };

      // Store server
      this.servers.set(name, server);

      // Set up event handlers
      serverProcess.stdout.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        logger.debug(`[${name}] ${output}`);
      });

      serverProcess.stderr.on("data", (data: Buffer) => {
        const output = data.toString().trim();
        logger.warn(`[${name}] ERROR: ${output}`);
      });

      serverProcess.on("error", (error: Error) => {
        logger.error(`[${name}] Process error: ${error.message}`);
        server.status = "error";
        server.error = error;
      });

      serverProcess.on("exit", (code: number | null, signal: string | null) => {
        logger.info(
          `[${name}] Process exited with code ${code}, signal ${signal}`
        );
        server.status = "stopped";
        this.servers.delete(name);
      });

      // TODO: Properly detect when server is ready
      // For now, just wait a short time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update status
      server.status = "running";
      logger.info(`MCP server started: ${name}`);
    } catch (error) {
      logger.error(`Failed to start MCP server: ${name}`, { error });
      throw error;
    }
  }

  /**
   * Stop an MCP server
   * @param name Server name
   */
  async stopServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) {
      logger.debug(`Server not running: ${name}`);
      return;
    }

    logger.info(`Stopping MCP server: ${name}`);
    server.status = "stopping";

    try {
      // Close the client if it exists
      if (server.client) {
        await this.disconnectClient(name);
      }

      // Kill the process
      server.process.kill();

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        server.process.on("exit", () => {
          resolve();
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (server.process.killed) {
            logger.warn(
              `Server process did not exit gracefully: ${name}, forcing SIGKILL`
            );
            server.process.kill("SIGKILL");
          }
          resolve();
        }, 5000);
      });

      // Remove from servers map
      this.servers.delete(name);
      logger.info(`MCP server stopped: ${name}`);
    } catch (error) {
      logger.error(`Error stopping MCP server: ${name}`, { error });
      throw error;
    }
  }

  /**
   * Connect to an MCP server
   * @param name Server name or URL
   * @returns MCP client
   */
  async connectClient(name: string): Promise<MCPClient> {
    // Check if client already exists
    if (this.clients.has(name)) {
      return this.clients.get(name)!;
    }

    // Determine server URL
    let url: string;
    if (name.startsWith("http")) {
      // Direct URL
      url = name;
    } else {
      // Get from registry
      const config = this.registry.getServer(name);
      if (!config) {
        throw new Error(`Server not found in registry: ${name}`);
      }

      // Start server if not running
      if (!this.servers.has(name)) {
        await this.startServer(name);
      }

      // Use default URL if not specified
      url = "http://localhost:3000"; // Default URL
    }

    logger.info(`Connecting to MCP server: ${name} (${url})`);

    try {
      // Create client
      const client: MCPClient = {
        baseUrl: url,
        // Initialize with other properties as needed
      };

      // Store client
      this.clients.set(name, client);

      // Update server info if this is a managed server
      const server = this.servers.get(name);
      if (server) {
        server.client = client;
        server.url = url;
      }

      logger.info(`Connected to MCP server: ${name}`);
      return client;
    } catch (error) {
      logger.error(`Error connecting to MCP server: ${name}`, { error });
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   * @param name Server name or URL
   */
  async disconnectClient(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (!client) {
      logger.debug(`Client not connected: ${name}`);
      return;
    }

    logger.info(`Disconnecting from MCP server: ${name}`);

    try {
      // Remove client
      this.clients.delete(name);

      // Update server info if this is a managed server
      const server = this.servers.get(name);
      if (server) {
        server.client = undefined;
      }

      logger.info(`Disconnected from MCP server: ${name}`);
    } catch (error) {
      logger.error(`Error disconnecting from MCP server: ${name}`, { error });
      throw error;
    }
  }

  /**
   * Get an MCP client
   * @param name Server name or URL
   * @returns MCP client or undefined if not connected
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Get all connected clients
   * @returns Map of server names to clients
   */
  getClients(): Map<string, MCPClient> {
    return this.clients;
  }

  /**
   * Close all connections and stop all servers
   */
  async close(): Promise<void> {
    logger.info("Closing all MCP connections and servers");

    // Disconnect all clients
    for (const name of this.clients.keys()) {
      await this.disconnectClient(name);
    }

    // Stop all servers
    for (const name of this.servers.keys()) {
      await this.stopServer(name);
    }

    logger.info("All MCP connections and servers closed");
  }
}

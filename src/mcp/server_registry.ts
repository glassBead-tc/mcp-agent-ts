/**
 * Server registry for MCP Agent
 * Manages MCP server configurations and instances
 */
import { getLogger } from "../logging/logger.js";
import { ServerConfig } from "../config.js";

const logger = getLogger("server-registry");

/**
 * Server registry class
 * Manages the MCP servers available to the agent
 */
export class ServerRegistry {
  private servers: Map<string, ServerConfig> = new Map();

  /**
   * Create a new server registry
   * @param initialServers Initial server configurations
   */
  constructor(initialServers: Record<string, ServerConfig> = {}) {
    // Add initial servers
    Object.entries(initialServers).forEach(([name, config]) => {
      this.addServer(name, config);
    });
  }

  /**
   * Add a server to the registry
   * @param name Server name
   * @param config Server configuration
   */
  addServer(name: string, config: ServerConfig): void {
    this.servers.set(name, config);
    logger.debug(`Added server: ${name}`, { config });
  }

  /**
   * Get a server configuration by name
   * @param name Server name
   * @returns Server configuration or undefined if not found
   */
  getServer(name: string): ServerConfig | undefined {
    return this.servers.get(name);
  }

  /**
   * Remove a server from the registry
   * @param name Server name
   * @returns True if the server was removed, false otherwise
   */
  removeServer(name: string): boolean {
    return this.servers.delete(name);
  }

  /**
   * Check if a server exists in the registry
   * @param name Server name
   * @returns True if the server exists, false otherwise
   */
  hasServer(name: string): boolean {
    return this.servers.has(name);
  }

  /**
   * Get all server names
   * @returns Array of server names
   */
  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Get all server configurations
   * @returns Record of server configurations
   */
  getServers(): Record<string, ServerConfig> {
    const result: Record<string, ServerConfig> = {};
    this.servers.forEach((config, name) => {
      result[name] = config;
    });
    return result;
  }

  /**
   * Get the number of registered servers
   * @returns Number of servers
   */
  size(): number {
    return this.servers.size;
  }
}

/**
 * MCP server registry for MCP Agent
 */
import { Settings } from '../config.js';
import { getLogger } from '../logging/logger.js';

const logger = getLogger('server_registry');

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  url?: string;
  type?: string;
  api_key?: string;
  model?: string;
  options?: Record<string, any>;
  [key: string]: any;
}

/**
 * MCP server registry for managing MCP servers
 */
export class ServerRegistry {
  private servers: Map<string, MCPServerConfig> = new Map();
  
  constructor(private config: Settings) {
    this.loadServersFromConfig();
  }
  
  /**
   * Load servers from configuration
   */
  private loadServersFromConfig(): void {
    const serverConfigs = this.config.mcp_servers || {};
    
    for (const [name, config] of Object.entries(serverConfigs)) {
      this.registerServer(name, config as MCPServerConfig);
    }
  }
  
  /**
   * Register a server
   */
  registerServer(name: string, config: MCPServerConfig): void {
    logger.debug(`Registering MCP server ${name}`, { config });
    this.servers.set(name, config);
  }
  
  /**
   * Get a server by name
   */
  getServer(name: string): MCPServerConfig | undefined {
    return this.servers.get(name);
  }
  
  /**
   * List all registered servers
   */
  listServers(): { name: string; config: MCPServerConfig }[] {
    return Array.from(this.servers.entries()).map(([name, config]) => ({
      name,
      config,
    }));
  }
  
  /**
   * Check if a server exists
   */
  hasServer(name: string): boolean {
    return this.servers.has(name);
  }
  
  /**
   * Remove a server
   */
  removeServer(name: string): boolean {
    return this.servers.delete(name);
  }
}

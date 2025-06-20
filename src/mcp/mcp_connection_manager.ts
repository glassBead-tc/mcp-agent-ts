/**
 * MCP connection manager for MCP Agent
 */
import { Client } from '@modelcontextprotocol/sdk/client';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { getLogger } from '../logging/logger.js';
import { ServerRegistry, MCPServerConfig } from './server_registry.js';
import { Context } from '../context.js';
import { ServerInitializationError } from '../core/exceptions.js';

const logger = getLogger('mcp_connection_manager');

/**
 * MCP connection manager for managing connections to MCP servers
 */
export class MCPConnectionManager {
  private connections: Map<string, Client> = new Map();
  private initialized = false;
  
  constructor(
    protected context: Context,
    protected serverNames: string[] = [],
    protected connectionPersistence: boolean = true
  ) {}
  
  /**
   * Initialize the connection manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    logger.debug('Initializing MCP connection manager');
    
    // Load servers from registry
    await this.loadServers();
    
    this.initialized = true;
  }
  
  /**
   * Load servers from registry
   */
  protected async loadServers(): Promise<void> {
    const serverRegistry = this.context.serverRegistry;
    
    // If no server names specified, load all servers
    if (this.serverNames.length === 0) {
      this.serverNames = serverRegistry.listServers().map(server => server.name);
    }
    
    // Connect to each server
    for (const serverName of this.serverNames) {
      await this.connectToServer(serverName);
    }
  }
  
  /**
   * Connect to a server
   */
  protected async connectToServer(serverName: string): Promise<Client | undefined> {
    const serverRegistry = this.context.serverRegistry;
    const serverConfig = serverRegistry.getServer(serverName);
    
    if (!serverConfig) {
      logger.warn(`Server ${serverName} not found in registry`);
      return undefined;
    }
    
    try {
      logger.debug(`Connecting to MCP server ${serverName}`, { serverConfig });
      
      // Create client
      const client = await this.createClient(serverName, serverConfig);
      
      // Store connection
      this.connections.set(serverName, client);
      
      return client;
    } catch (error) {
      logger.error(`Error connecting to MCP server ${serverName}`, { error });
      return undefined;
    }
  }
  
  /**
   * Create a client for a server
   */
  protected async createClient(serverName: string, config: MCPServerConfig): Promise<Client> {
    let transport: Transport;

    try {
      if (config.type === 'websocket') {
        if (!config.url) {
          throw new ServerInitializationError(
            `Missing url for websocket server '${serverName}'`
          );
        }
        transport = new WebSocketClientTransport(new URL(config.url));
      } else if (config.type === 'stdio') {
        if (!config.command) {
          throw new ServerInitializationError(
            `Missing command for stdio server '${serverName}'`
          );
        }
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: config.env ? { ...getDefaultEnvironment(), ...config.env } : getDefaultEnvironment(),
          cwd: config.cwd,
        });
      } else {
        throw new ServerInitializationError(
          `Unsupported server type '${config.type}' for server '${serverName}'`
        );
      }
    } catch (error) {
      if (error instanceof ServerInitializationError) {
        throw error;
      }
      throw new ServerInitializationError(
        `Failed to initialize transport for server '${serverName}'`,
        String(error)
      );
    }
    
    // Create client
    const client = new Client(
      {
        name: `mcp-agent-ts-client-${serverName}`,
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          completions: true,
        },
      }
    );
    
    // Connect to transport
    await client.connect(transport);
    
    return client;
  }
  
  /**
   * Get a client by name
   */
  async getClient(serverName: string): Promise<Client | undefined> {
    // If not initialized, initialize first
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check if connection exists
    let client = this.connections.get(serverName);
    
    // If not, try to connect
    if (!client) {
      client = await this.connectToServer(serverName);
    }
    
    return client;
  }
  
  /**
   * Close all connections
   */
  async close(): Promise<void> {
    logger.debug('Closing MCP connections');
    
    // Close each connection
    for (const [serverName, client] of this.connections.entries()) {
      try {
        await client.close();
        logger.debug(`Closed connection to ${serverName}`);
      } catch (error) {
        logger.error(`Error closing connection to ${serverName}`, { error });
      }
    }
    
    // Clear connections
    this.connections.clear();
    this.initialized = false;
  }
}

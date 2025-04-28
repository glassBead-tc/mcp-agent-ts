/**
 * This module defines a `ServerRegistry` class for managing MCP server configurations
 * and initialization logic.
 *
 * The class loads server configurations from a YAML file,
 * supports dynamic registration of initialization hooks, and provides methods for
 * server initialization.
 */

import { asyncContextManager } from './context_dependent';
import { MemoryObjectReceiveStream, MemoryObjectSendStream } from 'anyio-streams';
import { ClientSession } from 'mcp';
import { StdioServerParameters, stdioClient, getDefaultEnvironment } from 'mcp/client/stdio';
import { sseClient } from 'mcp/client/sse';

import { 
  getSettings, 
  MCPServerAuthSettings, 
  MCPServerSettings, 
  Settings 
} from './config';

import { getLogger } from './logging/logger';
import { MCPConnectionManager } from './mcp/mcp_connection_manager';
import { websocketClient } from './mcp/websocket';

const logger = getLogger('mcp_server_registry');

/**
 * A type alias for an initialization hook function that is invoked after MCP server initialization.
 *
 * @param session - The client session for the server connection.
 * @param auth - The authentication configuration for the server.
 * @returns Result of the post-init hook (false indicates failure).
 */
export type InitHookCallable = (
  session: ClientSession | null, 
  auth: MCPServerAuthSettings | null
) => boolean;

/**
 * A registry for managing server configurations and initialization logic.
 *
 * The `ServerRegistry` class is responsible for loading server configurations
 * from a YAML file, registering initialization hooks, initializing servers,
 * and executing post-initialization hooks dynamically.
 */
export class ServerRegistry {
  /**
   * Loaded server configurations.
   */
  registry: Record<string, MCPServerSettings>;
  
  /**
   * Registered initialization hooks.
   */
  initHooks: Record<string, InitHookCallable> = {};
  
  /**
   * Connection manager for managing MCP server connections.
   */
  connectionManager: MCPConnectionManager;

  /**
   * Initialize the ServerRegistry with a configuration file.
   *
   * @param config - The Settings object containing the server configurations.
   * @param configPath - Path to the YAML configuration file.
   */
  constructor(config?: Settings, configPath?: string) {
    this.registry = config 
      ? config.mcp.servers 
      : this.loadRegistryFromFile(configPath);
    
    this.connectionManager = new MCPConnectionManager(this);
  }

  /**
   * Load the YAML configuration file and validate it.
   *
   * @param configPath - Path to the YAML configuration file.
   * @returns A dictionary of server configurations.
   * @throws ValueError: If the configuration is invalid.
   */
  loadRegistryFromFile(configPath?: string): Record<string, MCPServerSettings> {
    const servers = getSettings(configPath).mcp.servers || {};
    return servers;
  }

  /**
   * Starts the server process based on its configuration. To initialize, call initializeServer
   *
   * @param serverName - The name of the server to initialize.
   * @param clientSessionFactory - Factory function to create a client session.
   * @returns The server parameters for stdio transport.
   * @throws ValueError: If the server is not found or has an unsupported transport.
   */
  startServer = asyncContextManager(
    async (
      serverName: string,
      clientSessionFactory: (
        readStream: MemoryObjectReceiveStream<any>,
        writeStream: MemoryObjectSendStream<any>,
        readTimeoutMs?: number
      ) => ClientSession = ClientSession
    ): Promise<ClientSession> => {
      if (!this.registry[serverName]) {
        throw new Error(`Server '${serverName}' not found in registry.`);
      }

      const config = this.registry[serverName];
      const readTimeoutMs = config.readTimeoutSeconds 
        ? config.readTimeoutSeconds * 1000 
        : undefined;

      if (config.transport === 'stdio') {
        if (!config.command || !config.args) {
          throw new Error(`Command and args are required for stdio transport: ${serverName}`);
        }

        const serverParams: StdioServerParameters = {
          command: config.command,
          args: config.args,
          env: { ...getDefaultEnvironment(), ...(config.env || {}) }
        };

        const [readStream, writeStream] = await stdioClient(serverParams);
        const session = clientSessionFactory(
          readStream,
          writeStream,
          readTimeoutMs
        );

        logger.info(`${serverName}: Connected to server using stdio transport.`);
        
        try {
          return session;
        } finally {
          logger.debug(`${serverName}: Closed session to server`);
        }
      } 
      else if (config.transport === 'sse') {
        if (!config.url) {
          throw new Error(`URL is required for SSE transport: ${serverName}`);
        }

        // Use sse_client to get the read and write streams
        const [readStream, writeStream] = await sseClient(config.url, config.headers);
        const session = clientSessionFactory(
          readStream,
          writeStream,
          readTimeoutMs
        );
        
        logger.info(`${serverName}: Connected to server using SSE transport.`);
        
        try {
          return session;
        } finally {
          logger.debug(`${serverName}: Closed session to server`);
        }
      } 
      else if (config.transport === 'websocket') {
        if (!config.url) {
          throw new Error(`URL is required for websocket transport: ${serverName}`);
        }

        const [readStream, writeStream] = await websocketClient(config.url, config.headers);
        const session = clientSessionFactory(
          readStream,
          writeStream,
          readTimeoutMs
        );
        
        logger.info(`${serverName}: Connected to server using websocket transport.`);
        
        try {
          return session;
        } finally {
          logger.debug(`${serverName}: Closed session to server`);
        }
      } 
      // Unsupported transport
      else {
        throw new Error(`Unsupported transport: ${config.transport}`);
      }
    }
  );

  /**
   * Initialize a server based on its configuration.
   * After initialization, also calls any registered or provided initialization hook for the server.
   *
   * @param serverName - The name of the server to initialize.
   * @param clientSessionFactory - Factory function to create a client session.
   * @param initHook - Optional initialization hook function to call after initialization.
   * @returns The initialized client session.
   * @throws ValueError: If the server is not found or has an unsupported transport.
   */
  initializeServer = asyncContextManager(
    async (
      serverName: string,
      clientSessionFactory: (
        readStream: MemoryObjectReceiveStream<any>,
        writeStream: MemoryObjectSendStream<any>,
        readTimeoutMs?: number
      ) => ClientSession = ClientSession,
      initHook?: InitHookCallable
    ): Promise<ClientSession> => {
      if (!this.registry[serverName]) {
        throw new Error(`Server '${serverName}' not found in registry.`);
      }

      const config = this.registry[serverName];
      const session = await this.startServer(serverName, clientSessionFactory);

      try {
        logger.info(`${serverName}: Initializing server...`);
        await session.initialize();
        logger.info(`${serverName}: Initialized.`);

        const initializationCallback = initHook || this.initHooks[serverName];

        if (initializationCallback) {
          logger.info(`${serverName}: Executing init hook`);
          initializationCallback(session, config.auth || null);
        }

        logger.info(`${serverName}: Up and running!`);
        return session;
      } catch (e) {
        logger.error(`${serverName}: Error during initialization: ${e}`);
        throw e;
      } finally {
        logger.info(`${serverName}: Ending server session.`);
      }
    }
  );

  /**
   * Register an initialization hook for a specific server. This will get called
   * after the server is initialized.
   *
   * @param serverName - The name of the server.
   * @param hook - The initialization function to register.
   */
  registerInitHook(serverName: string, hook: InitHookCallable): void {
    if (!this.registry[serverName]) {
      throw new Error(`Server '${serverName}' not found in registry.`);
    }

    this.initHooks[serverName] = hook;
  }

  /**
   * Execute the initialization hook for a specific server.
   *
   * @param serverName - The name of the server.
   * @param session - The session object to pass to the initialization hook.
   * @returns Result of the hook execution.
   */
  executeInitHook(serverName: string, session: ClientSession | null = null): boolean {
    if (this.initHooks[serverName]) {
      const hook = this.initHooks[serverName];
      const config = this.registry[serverName];
      logger.info(`Executing init hook for '${serverName}'`);
      return hook(session, config.auth || null);
    } else {
      logger.info(`No init hook registered for '${serverName}'`);
      return true; // Default to success
    }
  }

  /**
   * Get the configuration for a specific server.
   *
   * @param serverName - The name of the server.
   * @returns The server configuration or null if not found.
   */
  getServerConfig(serverName: string): MCPServerSettings | null {
    const serverConfig = this.registry[serverName];
    if (!serverConfig) {
      logger.warning(`Server '${serverName}' not found in registry.`);
      return null;
    } else if (!serverConfig.name) {
      serverConfig.name = serverName;
    }
    return serverConfig;
  }
}
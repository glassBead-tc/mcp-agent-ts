import { asyncContextManager } from '../context_dependent.js';
import { MemoryObjectReceiveStream, MemoryObjectSendStream } from 'anyio-streams';
import { ClientSession } from 'mcp';
import { JSONRPCMessage } from 'mcp/types';
import { getLogger } from '../logging/logger.js';
import { ServerRegistry } from './server_registry.js';
import { MCPAgentClientSession } from './mcp_agent_client_session.js';

const logger = getLogger('mcp/gen_client');

/**
 * Create a client session to the specified server.
 * Handles server startup, initialization, and message receive loop setup.
 * If required, callers can specify their own message receive loop and ClientSession class constructor to customize further.
 * For persistent connections, use connect() or MCPConnectionManager instead.
 */
export const genClient = asyncContextManager(
  async (
    serverName: string,
    serverRegistry: ServerRegistry,
    clientSessionFactory: (
      readStream: MemoryObjectReceiveStream<JSONRPCMessage | Error>,
      writeStream: MemoryObjectSendStream<JSONRPCMessage>,
      readTimeoutMs?: number
    ) => ClientSession = MCPAgentClientSession
  ): Promise<ClientSession> => {
    if (!serverRegistry) {
      throw new Error(
        'Server registry not found in the context. Please specify one either on this method, or in the context.'
      );
    }

    return await serverRegistry.initializeServer(
      serverName,
      clientSessionFactory
    );
  }
);

/**
 * Create a persistent client session to the specified server.
 * Handles server startup, initialization, and message receive loop setup.
 * If required, callers can specify their own message receive loop and ClientSession class constructor to customize further.
 */
export async function connect(
  serverName: string,
  serverRegistry: ServerRegistry,
  clientSessionFactory: (
    readStream: MemoryObjectReceiveStream<JSONRPCMessage | Error>,
    writeStream: MemoryObjectSendStream<JSONRPCMessage>,
    readTimeoutMs?: number
  ) => ClientSession = MCPAgentClientSession
): Promise<ClientSession> {
  if (!serverRegistry) {
    throw new Error(
      'Server registry not found in the context. Please specify one either on this method, or in the context.'
    );
  }

  const serverConnection = await serverRegistry.connectionManager.getServer(
    serverName,
    clientSessionFactory
  );

  return serverConnection.session;
}

/**
 * Disconnect from the specified server. If serverName is null, disconnect from all servers.
 */
export async function disconnect(
  serverName: string | null,
  serverRegistry: ServerRegistry
): Promise<void> {
  if (!serverRegistry) {
    throw new Error(
      'Server registry not found in the context. Please specify one either on this method, or in the context.'
    );
  }

  if (serverName) {
    await serverRegistry.connectionManager.disconnectServer(serverName);
  } else {
    await serverRegistry.connectionManager.disconnectAll();
  }
}
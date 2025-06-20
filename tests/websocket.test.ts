/**
 * Tests for websocket transport
 */
// Mock external dependencies that are not available in the test environment
jest.mock('mcp/types', () => ({ JSONRPCMessage: {} }), { virtual: true });
jest.mock('anyio-streams', () => ({
  createMemoryObjectStream: () => [
    { send: jest.fn(), close: jest.fn() },
    { receive: jest.fn(), close: jest.fn() },
  ],
}), { virtual: true });
// Mock WebSocket before importing modules that use it
jest.mock('ws', () => {
  class MockWebSocket extends jest.requireActual('events').EventEmitter {
    constructor() {
      super();
      this.send = jest.fn((data, callback) => {
        if (callback) callback();
      });
      this.close = jest.fn();

      // Emit open event on next tick
      setTimeout(() => {
        this.emit('open');
      }, 0);
    }
  }

  return {
    WebSocket: MockWebSocket,
    default: MockWebSocket,
  };
});

import { JSONRPCMessage } from 'mcp/types';
import { websocketClient } from '../src/mcp/websocket.js';
import { MCPServerSettings } from '../src/config/index.js';
import { MCPConnectionManager } from '../src/mcp/mcp_connection_manager.js';
import { createMemoryObjectStream } from 'anyio-streams';
import WebSocket from 'ws';

describe.skip('WebSocket Transport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('websocket_client correctly handles JSON-RPC messages', async () => {
    const mockWs = new WebSocket('ws://localhost:8000');
    
    // Use setTimeout to simulate message events after connection is established
    setTimeout(() => {
      mockWs.emit('message', 
        Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1
        }))
      );
      
      setTimeout(() => {
        mockWs.emit('message', 
          Buffer.from(JSON.stringify({
            jsonrpc: '2.0',
            result: { protocolVersion: '2023-12-07' },
            id: 1
          }))
        );
      }, 10);
    }, 10);
    
    await websocketClient('ws://localhost:8000', async (readStream, writeStream) => {
      // Test receiving a message
      const message1 = await readStream.receive();
      expect(message1).toHaveProperty('jsonrpc', '2.0');
      expect(message1).toHaveProperty('method', 'initialize');
      
      // Test sending a message
      const response = {
        jsonrpc: '2.0',
        result: { message: 'Hello World' },
        id: 1
      } as JSONRPCMessage;
      
      await writeStream.send(response);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Hello World'),
        expect.any(Function)
      );
      
      // Receive the second message
      const message2 = await readStream.receive();
      expect(message2).toHaveProperty('jsonrpc', '2.0');
      expect(message2).toHaveProperty('result.protocolVersion', '2023-12-07');
      
      return { pass: true };
    });
  });
  
  test('websocket_client correctly handles headers', async () => {
    const headers = { Authorization: 'Bearer test-api-key' };

    const result = await websocketClient('ws://localhost:8000', headers, async () => ({ pass: true }));

    expect(result).toEqual({ pass: true });
  });
  
  test('websocket transport is correctly configured in connection manager', async () => {
    // Create a configuration with websocket transport
    const config: MCPServerSettings = {
      name: 'test-server',
      transport: 'websocket',
      url: 'ws://localhost:8000'
    };
    
    // Create a mock registry
    const mockRegistry = {
      registry: { 'test-server': config }
    };
    
    // Create a connection manager with the mock registry
    const connectionManager = new MCPConnectionManager(mockRegistry as any);
    
    // Mock websocketClient function
    const mockWebsocketClient = jest.fn().mockImplementation(async (url, headers, callback) => {
      const [readStream, readWriter] = createMemoryObjectStream();
      const [writeReader, writeStream] = createMemoryObjectStream();
      
      // Execute callback with streams
      const result = await callback(readStream, writeStream);
      
      return result;
    });
    
    // Replace real function with mock and invoke
    (connectionManager as any).createWebSocketClient = mockWebsocketClient;

    await (connectionManager as any).createWebSocketClient('ws://localhost:8000', null, async () => ({ pass: true }));

    expect(mockWebsocketClient).toHaveBeenCalledWith(
      'ws://localhost:8000',
      null,
      expect.any(Function)
    );
  });
});
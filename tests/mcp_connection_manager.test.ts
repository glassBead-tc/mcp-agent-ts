import { MCPConnectionManager } from '../src/mcp/mcp_connection_manager.js';
import { Context } from '../src/context/index.js';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';

jest.mock('@modelcontextprotocol/sdk/client');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('@modelcontextprotocol/sdk/client/websocket.js');

describe('MCPConnectionManager createClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates websocket transport when type is websocket', async () => {
    const transportInstance = {} as any;
    (WebSocketClientTransport as jest.Mock).mockImplementation(() => transportInstance);
    const clientInstance = { connect: jest.fn() } as any;
    (Client as unknown as jest.Mock).mockImplementation(() => clientInstance);

    const manager = new MCPConnectionManager(new Context());
    const client = await (manager as any).createClient('ws', { type: 'websocket', url: 'ws://localhost' });

    expect(WebSocketClientTransport).toHaveBeenCalledWith(new URL('ws://localhost'));
    expect(clientInstance.connect).toHaveBeenCalledWith(transportInstance);
    expect(client).toBe(clientInstance);
  });

  test('creates stdio transport when type is stdio', async () => {
    const transportInstance = {} as any;
    (StdioClientTransport as jest.Mock).mockImplementation(() => transportInstance);
    const clientInstance = { connect: jest.fn() } as any;
    (Client as unknown as jest.Mock).mockImplementation(() => clientInstance);

    const manager = new MCPConnectionManager(new Context());
    const client = await (manager as any).createClient('stdio', { type: 'stdio', command: 'cmd', args: ['a'] });

    expect(StdioClientTransport).toHaveBeenCalledWith({
      command: 'cmd',
      args: ['a'],
      env: expect.any(Object),
      cwd: undefined,
    });
    expect(clientInstance.connect).toHaveBeenCalledWith(transportInstance);
    expect(client).toBe(clientInstance);
  });
});

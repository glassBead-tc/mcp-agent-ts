/**
 * Websocket transport layer for MCP agent to connect to MCP servers.
 */

import { asyncContextManager } from '../context_dependent';
import { MemoryObjectReceiveStream, MemoryObjectSendStream, createMemoryObjectStream } from 'anyio-streams';
import { JSONRPCMessage } from 'mcp/types';
import { getLogger } from '../logging/logger';
import WebSocket from 'ws';

const logger = getLogger('mcp/websocket');

/**
 * WebSocket client transport for MCP Agent.
 *
 * Connects to 'url' using the 'mcp' subprotocol, then yields:
 *     [readStream, writeStream]
 *
 * - readStream: As you read from this stream, you'll receive either valid
 *   JSONRPCMessage objects or Exception objects (when validation fails).
 * - writeStream: Write JSONRPCMessage objects to this stream to send them
 *   over the WebSocket to the server.
 */
export const websocketClient = asyncContextManager(
  async (
    url: string,
    headers?: Record<string, any>
  ): Promise<[MemoryObjectReceiveStream<JSONRPCMessage | Error>, MemoryObjectSendStream<JSONRPCMessage>]> => {
    // Create two in-memory streams:
    // - One for incoming messages (readStream, written by wsReader)
    // - One for outgoing messages (writeStream, read by wsWriter)
    const [readStreamWriter, readStream] = createMemoryObjectStream<JSONRPCMessage | Error>(0);
    const [writeStream, writeStreamReader] = createMemoryObjectStream<JSONRPCMessage>(0);

    logger.debug(`Connecting to MCP server via WebSocket at ${url}`);

    try {
      // Connect using websockets, requesting the "mcp" subprotocol
      const ws = new WebSocket(url, ['mcp'], {
        headers
      });

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      logger.debug(`WebSocket connection established to ${url}`);

      const wsReader = async () => {
        try {
          ws.on('message', async (data: WebSocket.Data) => {
            try {
              const rawText = data.toString();
              // In TypeScript, we'd parse the JSON and validate against our schema
              // This is a placeholder for proper validation
              try {
                const message = JSON.parse(rawText) as JSONRPCMessage;
                await readStreamWriter.send(message);
              } catch (exc) {
                // If JSON parse or model validation fails, send the exception
                logger.warning(`Failed to parse WebSocket message: ${exc}`);
                await readStreamWriter.send(exc as Error);
              }
            } catch (e) {
              logger.error(`Error processing WebSocket message: ${e}`);
            }
          });

          ws.on('close', () => {
            readStreamWriter.close();
          });

          ws.on('error', (error) => {
            logger.error(`WebSocket error: ${error}`);
            readStreamWriter.close();
          });
        } catch (e) {
          logger.error(`Error in WebSocket reader: ${e}`);
        }
      };

      const wsWriter = async () => {
        try {
          // Read JSONRPCMessages from writeStreamReader and
          // send them to the server.
          for await (const message of writeStreamReader) {
            // Convert to object, then to JSON
            const msgObj = { ...message };
            // This is a simplification - in actual code we'd handle conversion properly
            await new Promise<void>((resolve, reject) => {
              ws.send(JSON.stringify(msgObj), (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          }
        } catch (e) {
          logger.error(`Error in WebSocket writer: ${e}`);
        } finally {
          ws.close();
        }
      };

      // Start reader and writer tasks
      wsReader();
      wsWriter();

      // Return the streams
      return [readStream, writeStream];
    } catch (e) {
      logger.error(`Failed to establish WebSocket connection to ${url}: ${e}`);
      throw e;
    }
  }
);
/**
 * A derived client session for the MCP Agent framework.
 * It adds logging and supports sampling requests.
 */

import { ClientSession } from 'mcp';
import { MemoryObjectReceiveStream, MemoryObjectSendStream } from 'anyio-streams';
import {
  JSONRPCMessage,
  CreateMessageRequestParams,
  CreateMessageResult,
  ErrorData,
  ServerRequest,
  CreateMessageRequest,
  ListRootsResult,
  Root,
  TextContent
} from 'mcp/types';
import { RequestContext, RequestId } from 'mcp/shared/session';
import { SamplingFnT, ListRootsFnT, LoggingFnT } from 'mcp/client/session';
import { MCPServerSettings } from '../config';
import { ContextDependent } from '../context_dependent';
import { getLogger } from '../logging/logger';

const logger = getLogger('mcp/mcp_agent_client_session');

/**
 * MCP Agent framework acts as a client to the servers providing tools/resources/prompts for the agent workloads.
 * This is a simple client session for those server connections, and supports
 *     - handling sampling requests
 *     - notifications
 *     - MCP root configuration
 *
 * Developers can extend this class to add more custom functionality as needed
 */
export class MCPAgentClientSession extends ClientSession implements ContextDependent {
  private serverConfig?: MCPServerSettings;

  constructor(
    readStream: MemoryObjectReceiveStream<JSONRPCMessage | Error>,
    writeStream: MemoryObjectSendStream<JSONRPCMessage>,
    readTimeoutMs?: number,
    samplingCallback?: SamplingFnT,
    listRootsCallback?: ListRootsFnT,
    loggingCallback?: LoggingFnT
  ) {
    if (!samplingCallback) {
      samplingCallback = this._handleSamplingCallback.bind(this);
    }
    
    if (!listRootsCallback) {
      listRootsCallback = this._handleListRootsCallback.bind(this);
    }

    super(
      readStream,
      writeStream, 
      readTimeoutMs,
      samplingCallback,
      listRootsCallback,
      loggingCallback
    );
  }

  async sendRequest<T, R>(request: T, resultType: new () => R): Promise<R> {
    logger.debug('send_request: request=', { data: JSON.stringify(request) });
    try {
      const result = await super.sendRequest(request, resultType);
      logger.debug('send_request: response=', { data: JSON.stringify(result) });
      return result;
    } catch (e) {
      logger.error(`send_request failed: ${e}`);
      throw e;
    }
  }

  async sendNotification(notification: any): Promise<void> {
    logger.debug('send_notification:', { data: JSON.stringify(notification) });
    try {
      return await super.sendNotification(notification);
    } catch (e) {
      logger.error('send_notification failed', { data: e });
      throw e;
    }
  }

  async _sendResponse(requestId: RequestId, response: any): Promise<void> {
    logger.debug(`send_response: request_id=${requestId}, response=`, {
      data: JSON.stringify(response)
    });
    return await super._sendResponse(requestId, response);
  }

  async _receivedNotification(notification: any): Promise<void> {
    /**
     * Can be overridden by subclasses to handle a notification without needing
     * to listen on the message stream.
     */
    logger.info('_received_notification: notification=', {
      data: JSON.stringify(notification)
    });
    return await super._receivedNotification(notification);
  }

  async sendProgressNotification(
    progressToken: string | number,
    progress: number,
    total?: number
  ): Promise<void> {
    /**
     * Sends a progress notification for a request that is currently being
     * processed.
     */
    logger.debug(
      `send_progress_notification: progress_token=${progressToken}, progress=${progress}, total=${total}`
    );
    return await super.sendProgressNotification(progressToken, progress, total);
  }

  async _handleSamplingCallback(
    context: RequestContext<ClientSession, any>,
    params: CreateMessageRequestParams
  ): Promise<CreateMessageResult | ErrorData> {
    logger.info(`Handling sampling request: ${JSON.stringify(params)}`);
    const config = this.context.config;
    const serverSession = this.context.upstreamSession;
    
    if (!serverSession) {
      // Handle case when no upstream client is available
      logger.warning(
        'Error: No upstream client available for sampling requests. Request:',
        { data: params }
      );
      
      try {
        // A simplified version of the Python implementation
        // In a real implementation we'd use the Anthropic SDK for TypeScript
        // This is just a placeholder
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.anthropic.apiKey
          },
          body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: params.maxTokens,
            messages: params.messages.map((m) => ({
              role: m.role,
              content: m.content.hasOwnProperty('text') 
                ? (m.content as any).text 
                : (m.content as any).data
            })),
            system: params.systemPrompt,
            temperature: params.temperature || 0.7,
            stop_sequences: params.stopSequences
          })
        });
        
        const data = await response.json();
        
        return {
          model: 'claude-3-sonnet-20240229',
          role: 'assistant',
          content: {
            type: 'text',
            text: data.content[0].text
          } as TextContent
        } as CreateMessageResult;
      } catch (e) {
        logger.error(`Error handling sampling request: ${e}`);
        return {
          code: -32603,
          message: String(e)
        } as ErrorData;
      }
    } else {
      try {
        // If a server_session is available, we'll pass-through the sampling request to the upstream client
        const result = await serverSession.sendRequest(
          {
            method: 'sampling/createMessage',
            params: params
          } as CreateMessageRequest,
          CreateMessageResult
        );

        // Pass the result from the upstream client back to the server. We just act as a pass-through client here.
        return result;
      } catch (e) {
        return {
          code: -32603,
          message: String(e)
        } as ErrorData;
      }
    }
  }

  async _handleListRootsCallback(
    context: RequestContext<ClientSession, any>
  ): Promise<ListRootsResult | ErrorData> {
    // Handle list_roots request by returning configured roots
    if (this.serverConfig?.roots) {
      const roots = this.serverConfig.roots.map(root => ({
        uri: root.serverUriAlias || root.uri,
        name: root.name
      } as Root));

      return { roots } as ListRootsResult;
    } else {
      return { roots: [] } as ListRootsResult;
    }
  }
}
/**
 * MCP aggregator for MCP Agent
 */
import { Client } from '@modelcontextprotocol/sdk/client';
import { CallToolRequest, CallToolResult, ListToolsResult, Tool } from '@modelcontextprotocol/sdk/types';
import { MCPConnectionManager } from './mcp_connection_manager.js';
import { Context } from '../context.js';
import { getLogger } from '../logging/logger.js';

const logger = getLogger('mcp_aggregator');

/**
 * MCP aggregator for aggregating results from multiple MCP servers
 */
export class MCPAggregator extends MCPConnectionManager {
  protected initialized = false;
  
  constructor(
    context: Context,
    serverNames: string[] = [],
    connectionPersistence: boolean = true
  ) {
    super(context, serverNames, connectionPersistence);
  }
  
  /**
   * Initialize the aggregator
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    await super.initialize();
    this.initialized = true;
  }
  
  /**
   * List tools from all connected servers
   */
  async listTools(): Promise<ListToolsResult> {
    logger.debug('Listing tools from all servers');
    
    // If not initialized, initialize first
    if (!this.initialized) {
      await this.initialize();
    }
    
    const allTools: Tool[] = [];
    
    // Get tools from each server
    for (const serverName of this.serverNames) {
      try {
        const client = await this.getClient(serverName);
        if (!client) {
          logger.warn(`Client for server ${serverName} not found`);
          continue;
        }
        
        const result = await client.listTools();
        
        // Add server name to tool names to avoid conflicts
        const toolsWithPrefix = result.tools.map(tool => ({
          ...tool,
          name: `${serverName}:${tool.name}`,
          serverName, // Add server name for reference
        }));
        
        allTools.push(...toolsWithPrefix);
      } catch (error) {
        logger.error(`Error listing tools from server ${serverName}`, { error });
      }
    }
    
    return { tools: allTools };
  }
  
  /**
   * Call a tool on a specific server
   */
  async callTool(name: string, arguments_: Record<string, any> | null = null): Promise<CallToolResult> {
    logger.debug(`Calling tool ${name}`, { arguments: arguments_ });
    
    // If not initialized, initialize first
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Parse server name and tool name
    const [serverName, toolName] = name.split(':');
    
    if (!serverName || !toolName) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Invalid tool name: ${name}. Expected format: serverName:toolName`,
          },
        ],
      };
    }
    
    // Get client for server
    const client = await this.getClient(serverName);
    if (!client) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Server ${serverName} not found`,
          },
        ],
      };
    }
    
    try {
      // Call tool on server
      const result = await client.callTool({
        name: toolName,
        arguments: arguments_,
      });
      
      return result;
    } catch (error) {
      logger.error(`Error calling tool ${name}`, { error });
      
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error calling tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
  
  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await super.close();
    this.initialized = false;
  }
}

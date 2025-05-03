// Allow importing JSON files in TypeScript
declare module "*.json" {
  const value: any;
  export default value;
}

// Allow importing YAML files in TypeScript
declare module "*.yaml" {
  const value: any;
  export default value;
}

declare module "*.yml" {
  const value: any;
  export default value;
}

// Declare the MCP SDK
declare module "@modelcontextprotocol/sdk" {
  export interface MCPClientOptions {
    apiKey?: string;
    baseUrl?: string;
    [key: string]: any;
  }

  export interface ToolCallResult {
    name: string;
    arguments: Record<string, any>;
    result: any;
  }

  export interface GenerateOptions {
    messages: Array<{
      role: string;
      content: string;
      name?: string;
    }>;
    model: string;
    tools?: any[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: any;
  }

  export interface GenerateResult {
    content?: string;
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, any>;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }

  export class MCPClient {
    constructor(options?: MCPClientOptions);
    generate(options: GenerateOptions): Promise<GenerateResult>;
    listTools(): Promise<any[]>;
    callTool(name: string, args: Record<string, any>): Promise<any>;
  }
}

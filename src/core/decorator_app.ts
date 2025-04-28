/**
 * Decorator-based interface for MCP Agent applications.
 * Provides a simplified way to create and manage agents using decorators.
 */

import * as yaml from 'js-yaml';
import { MCPApp } from '../app.js';
import { Agent } from '../agents/agent.js';
import { Settings } from '../config.js';
import { Context } from '../context.js';
import { AugmentedLLM } from '../workflows/llm/augmented_llm.js';
import { AnthropicAugmentedLLM } from '../workflows/llm/augmented_llm_anthropic.js';

interface AgentConfig {
  instruction: string;
  servers: string[];
}

/**
 * A decorator-based interface for MCP Agent applications.
 * Provides a simplified way to create and manage agents using decorators.
 */
export class MCPAgentDecorator {
  name: string;
  configPath?: string;
  config?: Record<string, any>;
  app: MCPApp;
  agents: Record<string, AgentConfig> = {};

  /**
   * Initialize the decorator interface.
   *
   * @param name - Name of the application
   * @param configPath - Optional path to config file
   */
  constructor(name: string, configPath?: string) {
    this.name = name;
    this.configPath = configPath;
    this._loadConfig();
    this.app = new MCPApp({
      name,
      settings: this.config ? new Settings(this.config) : undefined
    });
  }

  /**
   * Load configuration, properly handling YAML without dotenv processing
   * @private
   */
  private _loadConfig(): void {
    if (this.configPath) {
      try {
        const fs = require('fs');
        const content = fs.readFileSync(this.configPath, 'utf8');
        this.config = yaml.load(content) as Record<string, any>;
      } catch (error) {
        console.error(`Error loading config file: ${error}`);
      }
    }
  }

  /**
   * Decorator to create and register an agent.
   *
   * @param name - Name of the agent
   * @param instruction - Base instruction for the agent
   * @param servers - List of server names the agent should connect to
   */
  agent(name: string, instruction: string, servers: string[]): Function {
    // Store the agent configuration for later instantiation
    this.agents[name] = { instruction, servers };

    // Return the decorator function
    return function decorator(target: Function): Function {
      // Original function is preserved
      return target;
    };
  }

  /**
   * Run the application.
   * Handles setup and teardown of the app and agents.
   *
   * @returns An async context manager for running the application
   */
  async run(): Promise<{ 
    wrapper: AgentAppWrapper; 
    cleanup: () => Promise<void>; 
  }> {
    let runContext: Context | undefined;
    
    // Initialize the app
    await this.app.initialize();
    runContext = this.app.context;
    
    const activeAgents: Record<string, Agent> = {};
    
    // Create and initialize all registered agents with proper context
    for (const [name, config] of Object.entries(this.agents)) {
      const agent = new Agent({
        name,
        instruction: config.instruction,
        serverNames: config.servers,
        context: runContext,
      });
      
      await agent.initialize();
      activeAgents[name] = agent;
      
      // Attach LLM to each agent
      const llm = await agent.attachLLM(async (a) => new AnthropicAugmentedLLM({ agent: a }));
      (agent as any)._llm = llm;
    }
    
    // Create a wrapper object with simplified interface
    const wrapper = new AgentAppWrapper(this.app, activeAgents);
    
    const cleanup = async () => {
      // Cleanup agents
      for (const agent of Object.values(activeAgents)) {
        await agent.shutdown();
      }
      
      // Cleanup app
      await this.app.cleanup();
    };
    
    return { wrapper, cleanup };
  }
}

/**
 * Wrapper class providing a simplified interface to the agent application.
 */
export class AgentAppWrapper {
  app: MCPApp;
  agents: Record<string, Agent>;

  /**
   * Create a new agent app wrapper
   * 
   * @param app - The MCPApp instance
   * @param agents - Map of agent names to agent instances
   */
  constructor(app: MCPApp, agents: Record<string, Agent>) {
    this.app = app;
    this.agents = agents;
  }

  /**
   * Send a message to a specific agent and get the response.
   *
   * @param agentName - Name of the agent to send message to
   * @param message - Message to send
   * @returns Agent's response
   */
  async send(agentName: string, message: string): Promise<any> {
    if (!this.agents[agentName]) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const agent = this.agents[agentName];
    if (!(agent as any)._llm) {
      throw new Error(`Agent ${agentName} has no LLM attached`);
    }
    
    const llm = (agent as any)._llm as AugmentedLLM;
    const result = await llm.generateStr(message);
    return result;
  }
}
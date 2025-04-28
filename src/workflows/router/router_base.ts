/**
 * Base Router implementation for MCP Agent
 * 
 * The Router pattern routes requests to the most appropriate agent or function
 * based on the content of the request.
 */
import { Agent } from '../../agents/agent.js';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('router_base');

/**
 * Result of a routing operation
 */
export interface RoutingResult<T> {
  /** The item that was selected */
  result: T;
  /** The confidence score (0-1) */
  score: number;
  /** Additional metadata about the routing decision */
  metadata?: Record<string, any>;
}

/**
 * Base router class
 */
export abstract class RouterBase {
  protected agents: Agent[];
  protected functions: Function[];
  
  /**
   * Create a new router
   * 
   * @param options - Router options
   * @param options.agents - List of agents to route to
   * @param options.functions - List of functions to route to
   */
  constructor(options: {
    agents?: Agent[];
    functions?: Function[];
  } = {}) {
    this.agents = options.agents || [];
    this.functions = options.functions || [];
  }
  
  /**
   * Route a request to the top k most appropriate agents
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  abstract routeToAgent(
    request: string,
    topK?: number
  ): Promise<RoutingResult<Agent>[]>;
  
  /**
   * Route a request to the top k most appropriate functions
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  abstract routeToFunction(
    request: string,
    topK?: number
  ): Promise<RoutingResult<Function>[]>;
  
  /**
   * Route a request to the top k most appropriate agents or functions
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  abstract route(
    request: string,
    topK?: number
  ): Promise<RoutingResult<Agent | Function>[]>;
  
  /**
   * Add an agent to the router
   * 
   * @param agent - The agent to add
   */
  addAgent(agent: Agent): void {
    this.agents.push(agent);
  }
  
  /**
   * Add a function to the router
   * 
   * @param fn - The function to add
   */
  addFunction(fn: Function): void {
    this.functions.push(fn);
  }
}

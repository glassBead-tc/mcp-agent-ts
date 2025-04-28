/**
 * LLM-based Router implementation for MCP Agent
 * 
 * This router uses an LLM to determine the most appropriate agent or function
 * for a given request.
 */
import { z } from 'zod';
import { Agent } from '../../agents/agent.js';
import { AugmentedLLM } from '../llm/augmented_llm.js';
import { RouterBase, RoutingResult } from './router_base.js';
import { getLogger } from '../../logging/logger.js';

const logger = getLogger('router_llm');

/**
 * Schema for the router response
 */
const RouterResponseSchema = z.object({
  choices: z.array(z.object({
    name: z.string().describe('The name of the agent or function'),
    score: z.number().min(0).max(1).describe('Confidence score (0-1)'),
    reasoning: z.string().describe('Reasoning for this choice'),
  })),
});

type RouterResponse = z.infer<typeof RouterResponseSchema>;

/**
 * LLM-based router
 */
export class LLMRouter extends RouterBase {
  private llm: AugmentedLLM;
  
  /**
   * Create a new LLM router
   * 
   * @param options - Router options
   * @param options.llm - The LLM to use for routing
   * @param options.agents - List of agents to route to
   * @param options.functions - List of functions to route to
   */
  constructor(options: {
    llm: AugmentedLLM;
    agents?: Agent[];
    functions?: Function[];
  }) {
    super({
      agents: options.agents,
      functions: options.functions,
    });
    
    this.llm = options.llm;
  }
  
  /**
   * Generate a prompt for the router
   * 
   * @param request - The request to route
   * @param options - Options for the prompt
   * @returns The prompt
   */
  private generatePrompt(
    request: string,
    options: {
      agentsOnly?: boolean;
      functionsOnly?: boolean;
      topK?: number;
    } = {}
  ): string {
    const { agentsOnly, functionsOnly, topK = 1 } = options;
    
    let prompt = `You are a router that determines which agent or function is best suited to handle a user request.
Given the following request, determine the ${topK === 1 ? 'most' : `top ${topK}`} appropriate ${
      agentsOnly ? 'agent(s)' : functionsOnly ? 'function(s)' : 'agent(s) or function(s)'
    } to handle it.

Request: "${request}"

`;
    
    // Add agents
    if (!functionsOnly && this.agents.length > 0) {
      prompt += '\nAvailable Agents:\n';
      
      for (const agent of this.agents) {
        const instruction = typeof agent.instruction === 'function'
          ? agent.instruction({})
          : agent.instruction;
        
        prompt += `- ${agent.name}: ${instruction}\n`;
      }
    }
    
    // Add functions
    if (!agentsOnly && this.functions.length > 0) {
      prompt += '\nAvailable Functions:\n';
      
      for (const fn of this.functions) {
        prompt += `- ${fn.name}: ${fn.description || 'No description available'}\n`;
      }
    }
    
    prompt += `\nRespond with a JSON object containing your choices, with each choice having a name, score (0-1), and reasoning.
The choices should be ordered by score, with the highest score first.
Only include ${topK === 1 ? 'the single most' : `the top ${topK}`} appropriate choice(s).

Example response:
{
  "choices": [
    {
      "name": "agent_name_or_function_name",
      "score": 0.95,
      "reasoning": "This agent/function is best suited because..."
    }${topK > 1 ? `,
    {
      "name": "second_choice_name",
      "score": 0.85,
      "reasoning": "This is the second best choice because..."
    }` : ''}
  ]
}`;
    
    return prompt;
  }
  
  /**
   * Route a request to the top k most appropriate agents
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  async routeToAgent(
    request: string,
    topK: number = 1
  ): Promise<RoutingResult<Agent>[]> {
    if (this.agents.length === 0) {
      throw new Error('No agents available for routing');
    }
    
    const prompt = this.generatePrompt(request, { agentsOnly: true, topK });
    
    try {
      const result = await this.llm.complete([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.2, // Low temperature for more deterministic results
      });
      
      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      try {
        const parsed = JSON.parse(jsonStr);
        const validated = RouterResponseSchema.parse(parsed);
        
        // Map choices to agents
        return validated.choices.map(choice => {
          const agent = this.agents.find(a => a.name === choice.name);
          
          if (!agent) {
            throw new Error(`Agent "${choice.name}" not found`);
          }
          
          return {
            result: agent,
            score: choice.score,
            metadata: {
              reasoning: choice.reasoning,
            },
          };
        });
      } catch (error) {
        logger.error('Failed to parse router response', { error, content });
        
        // Fallback: return the first agent with a low confidence score
        return [{
          result: this.agents[0],
          score: 0.5,
          metadata: {
            error: 'Failed to parse router response',
            fallback: true,
          },
        }];
      }
    } catch (error) {
      logger.error('Error in LLM router', { error });
      throw error;
    }
  }
  
  /**
   * Route a request to the top k most appropriate functions
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  async routeToFunction(
    request: string,
    topK: number = 1
  ): Promise<RoutingResult<Function>[]> {
    if (this.functions.length === 0) {
      throw new Error('No functions available for routing');
    }
    
    const prompt = this.generatePrompt(request, { functionsOnly: true, topK });
    
    try {
      const result = await this.llm.complete([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.2,
      });
      
      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      try {
        const parsed = JSON.parse(jsonStr);
        const validated = RouterResponseSchema.parse(parsed);
        
        // Map choices to functions
        return validated.choices.map(choice => {
          const fn = this.functions.find(f => f.name === choice.name);
          
          if (!fn) {
            throw new Error(`Function "${choice.name}" not found`);
          }
          
          return {
            result: fn,
            score: choice.score,
            metadata: {
              reasoning: choice.reasoning,
            },
          };
        });
      } catch (error) {
        logger.error('Failed to parse router response', { error, content });
        
        // Fallback: return the first function with a low confidence score
        return [{
          result: this.functions[0],
          score: 0.5,
          metadata: {
            error: 'Failed to parse router response',
            fallback: true,
          },
        }];
      }
    } catch (error) {
      logger.error('Error in LLM router', { error });
      throw error;
    }
  }
  
  /**
   * Route a request to the top k most appropriate agents or functions
   * 
   * @param request - The request to route
   * @param topK - Number of results to return
   * @returns Array of routing results
   */
  async route(
    request: string,
    topK: number = 1
  ): Promise<RoutingResult<Agent | Function>[]> {
    if (this.agents.length === 0 && this.functions.length === 0) {
      throw new Error('No agents or functions available for routing');
    }
    
    const prompt = this.generatePrompt(request, { topK });
    
    try {
      const result = await this.llm.complete([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.2,
      });
      
      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      try {
        const parsed = JSON.parse(jsonStr);
        const validated = RouterResponseSchema.parse(parsed);
        
        // Map choices to agents or functions
        return validated.choices.map(choice => {
          const agent = this.agents.find(a => a.name === choice.name);
          const fn = this.functions.find(f => f.name === choice.name);
          
          if (!agent && !fn) {
            throw new Error(`Agent or function "${choice.name}" not found`);
          }
          
          return {
            result: agent || fn!,
            score: choice.score,
            metadata: {
              reasoning: choice.reasoning,
              type: agent ? 'agent' : 'function',
            },
          };
        });
      } catch (error) {
        logger.error('Failed to parse router response', { error, content });
        
        // Fallback: return the first agent or function with a low confidence score
        const fallback = this.agents.length > 0 ? this.agents[0] : this.functions[0];
        return [{
          result: fallback,
          score: 0.5,
          metadata: {
            error: 'Failed to parse router response',
            fallback: true,
            type: this.agents.length > 0 ? 'agent' : 'function',
          },
        }];
      }
    } catch (error) {
      logger.error('Error in LLM router', { error });
      throw error;
    }
  }
}

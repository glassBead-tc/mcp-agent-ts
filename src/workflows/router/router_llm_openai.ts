import { Agent } from '../../agents/agent.js';
import { OpenAIAugmentedLLM } from '../llm/augmented_llm_openai.js';
import { LLMRouter } from './router_llm.js';
import { Context } from '../../context.js';

const ROUTING_SYSTEM_INSTRUCTION = `
You are a highly accurate request router that directs incoming requests to the most appropriate category.
A category is a specialized destination, such as a Function, an MCP Server (a collection of tools/functions), or an Agent (a collection of servers).
You will be provided with a request and a list of categories to choose from.
You can choose one or more categories, or choose none if no category is appropriate.
`;

/**
 * An LLM router that uses an OpenAI model to make routing decisions.
 */
export class OpenAILLMRouter extends LLMRouter {
  constructor(
    serverNames?: string[],
    agents?: Agent[],
    functions?: Function[],
    routingInstruction?: string,
    context?: Context,
    ...args: any[]
  ) {
    const openaiLlm = new OpenAIAugmentedLLM({
      instruction: ROUTING_SYSTEM_INSTRUCTION,
      context
    });

    super({
      llm: openaiLlm,
      serverNames,
      agents,
      functions,
      routingInstruction,
      context,
      ...args
    });
  }

  /**
   * Factory method to create and initialize a router.
   * Use this instead of constructor since we need async initialization.
   */
  static async create(
    serverNames?: string[],
    agents?: Agent[],
    functions?: Function[],
    routingInstruction?: string,
    context?: Context
  ): Promise<OpenAILLMRouter> {
    const instance = new OpenAILLMRouter(
      serverNames,
      agents,
      functions,
      routingInstruction,
      context
    );
    await instance.initialize();
    return instance;
  }
}
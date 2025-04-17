/**
 * Orchestrator workflow implementation for MCP Agent
 *
 * This workflow generates a plan for a complex task, executes the steps in the plan
 * using specialized agents, and then summarizes the results.
 */
import { Agent } from "../../agents/agent";
import {
  AugmentedLLM,
  Message,
  CompletionOptions,
  CompletionResult,
} from "../llm/augmented_llm";
import {
  Plan,
  PlanSchema,
  PlanStep,
  StepResult,
  StepStatus,
  StepStatusInfo,
  NextStep,
  NextStepSchema,
  formatPlanResult,
} from "./orchestrator_models";
import {
  PLAN_GENERATION_PROMPT,
  STEP_EXECUTION_PROMPT,
  SUMMARY_GENERATION_PROMPT,
  ITERATIVE_PLAN_PROMPT,
} from "./orchestrator_prompts";
import { getLogger } from "../../logging/logger";

const logger = getLogger("orchestrator");

/**
 * Type for the plan type
 */
export type PlanType = "full" | "iterative";

/**
 * Orchestrator workflow implementation
 */
export class Orchestrator extends AugmentedLLM {
  private availableAgents: Agent[];
  private llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
  private planner?: AugmentedLLM;
  private planType: PlanType;

  /**
   * Create a new orchestrator
   *
   * @param options - Orchestrator options
   * @param options.availableAgents - List of available agents
   * @param options.llmFactory - Factory function to create an LLM for each agent
   * @param options.planner - Optional custom planner LLM
   * @param options.planType - Type of planning to use ('full' or 'iterative', default: 'full')
   * @param options.model - Model to use (passed to parent)
   * @param options.apiKey - API key to use (passed to parent)
   * @param options.baseUrl - Base URL to use (passed to parent)
   * @param options.options - Additional options (passed to parent)
   */
  constructor(options: {
    availableAgents: Agent[];
    llmFactory: (agent: Agent) => Promise<AugmentedLLM>;
    planner?: AugmentedLLM;
    planType?: PlanType;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, any>;
  }) {
    // Create a dummy agent for the orchestrator
    const orchestratorAgent = new Agent({
      name: "orchestrator",
      instruction:
        "You are an orchestrator that coordinates multiple agents to complete complex tasks.",
    });

    super({
      agent: orchestratorAgent,
      model: options.model || "orchestrator",
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      options: options.options,
    });

    this.availableAgents = options.availableAgents;
    this.llmFactory = options.llmFactory;
    this.planner = options.planner;
    this.planType = options.planType || "full";
  }

  /**
   * Complete a conversation
   *
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async complete(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    logger.debug("Executing orchestrator", { messageCount: messages.length });

    try {
      // Extract the task from the messages
      const task = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n");

      let plan: Plan;
      let results: StepResult[] = [];

      if (this.planType === "iterative") {
        // Execute iterative planning
        const iterativeResult = await this.executeIterativePlan(task, options);
        plan = iterativeResult.plan;
        results = iterativeResult.results;
      } else {
        // Generate a full plan
        plan = await this.generatePlan(task, options);

        // Execute the plan
        results = await this.executePlan(plan, task, options);
      }

      // Generate a summary
      const summary = await this.generateSummary(plan, results, task, options);

      // Return the result
      return {
        id: `orchestrator-${Date.now()}`,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: summary,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0, // Not tracked
          completion_tokens: 0, // Not tracked
          total_tokens: 0, // Not tracked
        },
      };
    } catch (error) {
      logger.error("Error in orchestrator", { error });
      throw error;
    }
  }

  /**
   * Complete a conversation with tool calling
   *
   * @param messages - The messages to complete
   * @param options - Completion options
   * @returns The completion result
   */
  async completeWithTools(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    // For simplicity, we'll just use the regular complete method
    return this.complete(messages, options);
  }

  /**
   * Generate a plan for the task
   *
   * @param task - The task to generate a plan for
   * @param options - Completion options
   * @returns The generated plan
   */
  private async generatePlan(
    task: string,
    options?: CompletionOptions
  ): Promise<Plan> {
    logger.debug("Generating plan", { task });

    // Create a list of available agents
    const agentDescriptions = this.availableAgents
      .map((agent) => {
        const instruction =
          typeof agent.instruction === "function"
            ? agent.instruction({})
            : agent.instruction;

        return `- ${agent.name}: ${instruction}`;
      })
      .join("\n");

    // Generate the prompt
    const prompt = PLAN_GENERATION_PROMPT.replace(
      "{{agents}}",
      agentDescriptions
    ).replace("{{task}}", task);

    // Use the planner if provided, otherwise use the first available agent
    const planner =
      this.planner || (await this.llmFactory(this.availableAgents[0]));

    // Generate the plan
    const result = await planner.complete([{ role: "user", content: prompt }], {
      ...options,
      temperature: 0.2, // Lower temperature for more deterministic results
    });

    // Extract the plan from the result
    const content = result.choices[0].message.content;
    const jsonMatch =
      content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    try {
      const parsed = JSON.parse(jsonStr);
      const plan = PlanSchema.parse(parsed);

      // Validate that all agents exist
      for (const step of plan.steps) {
        const agent = this.availableAgents.find((a) => a.name === step.agent);
        if (!agent) {
          throw new Error(`Agent "${step.agent}" not found`);
        }

        // Validate that all dependencies exist
        if (step.dependencies) {
          for (const depId of step.dependencies) {
            const depStep = plan.steps.find((s) => s.id === depId);
            if (!depStep) {
              throw new Error(`Dependency "${depId}" not found`);
            }
          }
        }
      }

      return plan;
    } catch (error) {
      logger.error("Failed to parse plan", { error, content });
      throw new Error(
        `Failed to generate plan: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute a plan
   *
   * @param plan - The plan to execute
   * @param task - The original task
   * @param options - Completion options
   * @returns The results of all steps
   */
  private async executePlan(
    plan: Plan,
    task: string,
    options?: CompletionOptions
  ): Promise<StepResult[]> {
    logger.debug("Executing plan", { stepCount: plan.steps.length });

    // Initialize step statuses
    const stepStatuses = new Map<string, StepStatusInfo>();
    for (const step of plan.steps) {
      stepStatuses.set(step.id, {
        stepId: step.id,
        status: StepStatus.PENDING,
      });
    }

    // Initialize results
    const results: StepResult[] = [];

    // Execute steps until all are completed or failed
    while (true) {
      // Check if all steps are completed or failed
      const allDone = Array.from(stepStatuses.values()).every(
        (status) =>
          status.status === StepStatus.COMPLETED ||
          status.status === StepStatus.FAILED
      );

      if (allDone) {
        break;
      }

      // Find steps that are ready to execute
      const readySteps: PlanStep[] = [];

      for (const step of plan.steps) {
        const status = stepStatuses.get(step.id);

        if (!status || status.status !== StepStatus.PENDING) {
          continue;
        }

        // Check if all dependencies are completed
        const dependencies = step.dependencies || [];
        const allDepsCompleted = dependencies.every((depId) => {
          const depStatus = stepStatuses.get(depId);
          return depStatus && depStatus.status === StepStatus.COMPLETED;
        });

        if (allDepsCompleted) {
          readySteps.push(step);
        } else {
          // Mark as blocked if not already
          if (status.status !== StepStatus.BLOCKED) {
            stepStatuses.set(step.id, {
              ...status,
              status: StepStatus.BLOCKED,
            });
          }
        }
      }

      if (readySteps.length === 0) {
        // No steps are ready, but not all are done - this is a deadlock
        logger.error("Deadlock detected in plan execution");
        throw new Error("Deadlock detected in plan execution");
      }

      // Execute ready steps in parallel
      const stepPromises = readySteps.map((step) =>
        this.executeStep(step, plan, stepStatuses, task, options)
      );

      // Wait for all steps to complete
      const stepResults = await Promise.all(stepPromises);

      // Add results
      results.push(...stepResults);
    }

    return results;
  }

  /**
   * Execute a single step
   *
   * @param step - The step to execute
   * @param plan - The full plan
   * @param stepStatuses - Map of step statuses
   * @param task - The original task
   * @param options - Completion options
   * @returns The result of the step
   */
  private async executeStep(
    step: PlanStep,
    plan: Plan,
    stepStatuses: Map<string, StepStatusInfo>,
    task: string,
    options?: CompletionOptions
  ): Promise<StepResult> {
    logger.debug(`Executing step ${step.id}`, { step });

    // Update status to running
    stepStatuses.set(step.id, {
      stepId: step.id,
      status: StepStatus.RUNNING,
    });

    try {
      // Find the agent
      const agent = this.availableAgents.find((a) => a.name === step.agent);

      if (!agent) {
        throw new Error(`Agent "${step.agent}" not found`);
      }

      // Initialize agent if not already initialized
      if (!agent.initialized) {
        await agent.initialize();
      }

      // Create LLM for this agent
      const llm = await this.llmFactory(agent);

      // Get dependencies
      const dependencies: { stepId: string; result: string }[] = [];

      if (step.dependencies) {
        for (const depId of step.dependencies) {
          const depStatus = stepStatuses.get(depId);

          if (!depStatus || depStatus.status !== StepStatus.COMPLETED) {
            throw new Error(`Dependency "${depId}" is not completed`);
          }

          if (!depStatus.result) {
            throw new Error(`Dependency "${depId}" has no result`);
          }

          dependencies.push({
            stepId: depId,
            result: depStatus.result,
          });
        }
      }

      // Generate the prompt
      let prompt = STEP_EXECUTION_PROMPT.replace("{{agentName}}", agent.name)
        .replace("{{task}}", task)
        .replace("{{stepId}}", step.id)
        .replace("{{stepName}}", step.name)
        .replace("{{stepDescription}}", step.description);

      // Add dependencies
      if (dependencies.length > 0) {
        prompt = prompt.replace("{{#if dependencies.length}}", "");
        prompt = prompt.replace("{{/if}}", "");

        let depsText = "";
        for (const dep of dependencies) {
          depsText += `- ${dep.stepId}: ${dep.result}\n`;
        }

        prompt = prompt.replace("{{#each dependencies}}", "");
        prompt = prompt.replace("{{/each}}", "");
        prompt = prompt.replace("- {{this.stepId}}: {{this.result}}", depsText);
      } else {
        // Remove dependencies section
        prompt = prompt.replace(
          /{{#if dependencies.length}}[\s\S]*?{{\/if}}/g,
          ""
        );
      }

      // Execute the step
      const result = await llm.complete(
        [{ role: "user", content: prompt }],
        options
      );

      // Extract the result
      const resultText = result.choices[0].message.content;

      // Update status to completed
      stepStatuses.set(step.id, {
        stepId: step.id,
        status: StepStatus.COMPLETED,
        result: resultText,
      });

      return {
        stepId: step.id,
        result: resultText,
        success: true,
      };
    } catch (error) {
      logger.error(`Error executing step ${step.id}`, { error });

      // Update status to failed
      stepStatuses.set(step.id, {
        stepId: step.id,
        status: StepStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        stepId: step.id,
        result: `Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a summary of the results
   *
   * @param plan - The plan that was executed
   * @param results - The results of all steps
   * @param task - The original task
   * @param options - Completion options
   * @returns The summary
   */
  /**
   * Get the next step in iterative planning
   *
   * @param task - The task to generate a step for
   * @param results - The results of previous steps
   * @param options - Completion options
   * @returns The next step
   */
  private async getNextStep(
    task: string,
    results: StepResult[],
    options?: CompletionOptions
  ): Promise<NextStep> {
    logger.debug("Generating next step", { task, resultCount: results.length });

    // Create a list of available agents
    const agentDescriptions = this.availableAgents
      .map((agent) => {
        const instruction =
          typeof agent.instruction === "function"
            ? agent.instruction({})
            : agent.instruction;

        return `- ${agent.name}: ${instruction}`;
      })
      .join("\n");

    // Create a dummy plan for formatting
    const dummyPlan: Plan = {
      steps: [],
    };

    // Generate the prompt
    const prompt = ITERATIVE_PLAN_PROMPT.replace(
      "{{agents}}",
      agentDescriptions
    )
      .replace("{{task}}", task)
      .replace("{{planProgress}}", formatPlanResult(dummyPlan, results));

    // Use the planner if provided, otherwise use the first available agent
    const planner =
      this.planner || (await this.llmFactory(this.availableAgents[0]));

    // Generate the next step
    const result = await planner.complete([{ role: "user", content: prompt }], {
      ...options,
      temperature: 0.2, // Lower temperature for more deterministic results
    });

    // Extract the next step from the result
    const content = result.choices[0].message.content;
    const jsonMatch =
      content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    try {
      const parsed = JSON.parse(jsonStr);
      const nextStep = NextStepSchema.parse(parsed);

      // Validate that all agents exist
      for (const task of nextStep.tasks) {
        const agent = this.availableAgents.find((a) => a.name === task.agent);
        if (!agent) {
          throw new Error(`Agent "${task.agent}" not found`);
        }
      }

      return nextStep;
    } catch (error) {
      logger.error("Failed to parse next step", { error, content });
      throw new Error(
        `Failed to generate next step: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute a plan iteratively
   *
   * @param task - The task to execute
   * @param options - Completion options
   * @returns The plan and results
   */
  private async executeIterativePlan(
    task: string,
    options?: CompletionOptions
  ): Promise<{ plan: Plan; results: StepResult[] }> {
    logger.debug("Executing iterative plan", { task });

    const results: StepResult[] = [];
    const steps: PlanStep[] = [];
    let stepCounter = 1;
    let isComplete = false;

    // Execute steps until the plan is complete
    while (!isComplete) {
      // Get the next step
      const nextStep = await this.getNextStep(task, results, options);

      // Check if the plan is complete
      if (nextStep.is_complete) {
        isComplete = true;
        break;
      }

      // Convert the next step to a plan step
      const planStep: PlanStep = {
        id: `step${stepCounter}`,
        name: nextStep.description,
        description: nextStep.description,
        agent: nextStep.tasks[0].agent, // For simplicity, we'll use the first task's agent
        dependencies: [],
      };

      // Add the step to the plan
      steps.push(planStep);

      // Execute the step
      const stepStatuses = new Map<string, StepStatusInfo>();
      stepStatuses.set(planStep.id, {
        stepId: planStep.id,
        status: StepStatus.PENDING,
      });

      const stepResult = await this.executeStep(
        planStep,
        { steps },
        stepStatuses,
        task,
        options
      );

      // Add the result
      results.push(stepResult);

      // Increment the step counter
      stepCounter++;
    }

    // Return the plan and results
    return {
      plan: { steps, is_complete: true },
      results,
    };
  }

  /**
   * Generate a summary of the results
   *
   * @param plan - The plan that was executed
   * @param results - The results of all steps
   * @param task - The original task
   * @param options - Completion options
   * @returns The summary
   */
  private async generateSummary(
    plan: Plan,
    results: StepResult[],
    task: string,
    options?: CompletionOptions
  ): Promise<string> {
    logger.debug("Generating summary", { resultCount: results.length });

    // Generate the prompt
    let prompt = SUMMARY_GENERATION_PROMPT.replace("{{task}}", task);

    // Add plan steps
    let stepsText = "";
    for (const step of plan.steps) {
      stepsText += `- ${step.id}: ${step.name} (Agent: ${step.agent})\n`;
      stepsText += `  Description: ${step.description}\n`;
    }

    prompt = prompt.replace("{{#each steps}}", "");
    prompt = prompt.replace("{{/each}}", "");
    prompt = prompt.replace(
      "- {{this.id}}: {{this.name}} (Agent: {{this.agent}})\n  Description: {{this.description}}",
      stepsText
    );

    // Add results
    let resultsText = "";
    for (const result of results) {
      resultsText += `- ${result.stepId}: ${result.result}\n`;
    }

    prompt = prompt.replace("{{#each results}}", "");
    prompt = prompt.replace("{{/each}}", "");
    prompt = prompt.replace("- {{this.stepId}}: {{this.result}}", resultsText);

    // Use the first available agent for summarization
    const summarizer = await this.llmFactory(this.availableAgents[0]);

    // Generate the summary
    const result = await summarizer.complete(
      [{ role: "user", content: prompt }],
      options
    );

    // Extract the summary
    return result.choices[0].message.content;
  }
}

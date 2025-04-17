/**
 * Models for the Orchestrator workflow
 */
import { z } from "zod";

/**
 * Schema for a step in the plan
 */
export const PlanStepSchema = z.object({
  id: z.string().describe("Unique identifier for this step"),
  name: z.string().describe("Short name for this step"),
  description: z
    .string()
    .describe("Detailed description of what this step should accomplish"),
  agent: z.string().describe("Name of the agent that should execute this step"),
  dependencies: z
    .array(z.string())
    .optional()
    .describe("IDs of steps that must be completed before this step can start"),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

/**
 * Schema for the plan
 */
export const PlanSchema = z.object({
  steps: z.array(PlanStepSchema).describe("List of steps in the plan"),
  is_complete: z.boolean().optional().describe("Whether the plan is complete"),
});

export type Plan = z.infer<typeof PlanSchema>;

/**
 * Schema for the next step in iterative planning
 */
export const NextStepSchema = z.object({
  description: z.string().describe("Description of the next step"),
  tasks: z
    .array(
      z.object({
        description: z.string().describe("Description of the task"),
        agent: z.string().describe("Name of the agent to execute the task"),
      })
    )
    .describe("Tasks to execute in this step"),
  is_complete: z.boolean().describe("Whether the plan is complete"),
});

export type NextStep = z.infer<typeof NextStepSchema>;

/**
 * Schema for the result of a step
 */
export const StepResultSchema = z.object({
  stepId: z.string().describe("ID of the step"),
  result: z.string().describe("Result of the step"),
  success: z.boolean().describe("Whether the step was successful"),
  error: z.string().optional().describe("Error message if the step failed"),
});

export type StepResult = z.infer<typeof StepResultSchema>;

/**
 * Status of a step
 */
export enum StepStatus {
  PENDING = "pending",
  BLOCKED = "blocked",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * Schema for the status of a step
 */
export const StepStatusSchema = z.object({
  stepId: z.string().describe("ID of the step"),
  status: z.nativeEnum(StepStatus).describe("Status of the step"),
  result: z.string().optional().describe("Result of the step if completed"),
  error: z.string().optional().describe("Error message if the step failed"),
});

export type StepStatusInfo = z.infer<typeof StepStatusSchema>;

/**
 * Schema for the orchestration result
 */
export const OrchestrationResultSchema = z.object({
  plan: PlanSchema.describe("The plan that was executed"),
  results: z.array(StepResultSchema).describe("Results of all steps"),
  success: z.boolean().describe("Whether the orchestration was successful"),
  summary: z.string().describe("Summary of the orchestration"),
});

export type OrchestrationResult = z.infer<typeof OrchestrationResultSchema>;

/**
 * Format a plan result for display in prompts
 */
export function formatPlanResult(plan: Plan, results: StepResult[]): string {
  let output = "Plan Progress:\n";

  for (const step of plan.steps) {
    const stepResult = results.find((r) => r.stepId === step.id);
    const status = stepResult
      ? stepResult.success
        ? "COMPLETED"
        : "FAILED"
      : "PENDING";
    output += `- ${step.id}: ${step.name} (Agent: ${step.agent}) - ${status}\n`;
    output += `  Description: ${step.description}\n`;

    if (stepResult) {
      output += `  Result: ${stepResult.result}\n`;
    }
  }

  return output;
}

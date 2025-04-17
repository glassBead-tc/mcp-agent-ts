/**
 * Prompts for the Orchestrator workflow
 */

/**
 * Prompt for generating a full plan
 */
export const PLAN_GENERATION_PROMPT = `
You are a planner that breaks down complex tasks into a series of steps that can be executed by specialized agents.
Given a task, create a plan with steps that can be executed by the available agents.

Each step should have:
- A unique ID (e.g., "step1", "step2")
- A short name
- A detailed description of what the step should accomplish
- The name of the agent that should execute the step
- Dependencies (IDs of steps that must be completed before this step can start)

Available agents:
{{agents}}

Task: {{task}}

Respond with a JSON object containing the plan. Example:
{
  "steps": [
    {
      "id": "step1",
      "name": "Research information",
      "description": "Search for information about X",
      "agent": "researcher",
      "dependencies": []
    },
    {
      "id": "step2",
      "name": "Analyze findings",
      "description": "Analyze the information found in step 1",
      "agent": "analyst",
      "dependencies": ["step1"]
    }
  ],
  "is_complete": false
}
`;

/**
 * Prompt for generating the next step in iterative planning
 */
export const ITERATIVE_PLAN_PROMPT = `
You are tasked with determining only the next step needed to complete an objective.
You must analyze the current state and progress from previous steps to decide what to do next.

Objective: {{task}}

Current progress:
{{planProgress}}

If the previous results achieve the objective, return is_complete=true.
Otherwise, generate the next step.

Available agents:
{{agents}}

Generate the next step by specifying a description of the step and the agent that should execute it.

Return your response in the following JSON structure:
{
  "description": "Description of the next step",
  "tasks": [
    {
      "description": "Description of task 1",
      "agent": "agent_name"
    }
  ],
  "is_complete": false
}

You must respond with valid JSON only, with no triple backticks. No markdown formatting.
No extra text.
`;

/**
 * Prompt for executing a step
 */
export const STEP_EXECUTION_PROMPT = `
You are the {{agentName}} agent. You are executing a step in a larger plan.

Task: {{task}}

Step to execute:
ID: {{stepId}}
Name: {{stepName}}
Description: {{stepDescription}}

{{#if dependencies.length}}
Dependencies (already completed):
{{#each dependencies}}
- {{this.stepId}}: {{this.result}}
{{/each}}
{{/if}}

Execute this step and provide a detailed result.
`;

/**
 * Prompt for generating a summary
 */
export const SUMMARY_GENERATION_PROMPT = `
You are summarizing the results of a multi-step plan.

Original task: {{task}}

Plan:
{{#each steps}}
- {{this.id}}: {{this.name}} (Agent: {{this.agent}})
  Description: {{this.description}}
{{/each}}

Results:
{{#each results}}
- {{this.stepId}}: {{this.result}}
{{/each}}

Provide a comprehensive summary of the results, integrating the outputs from all steps into a cohesive response.
`;

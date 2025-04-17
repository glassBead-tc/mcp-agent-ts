# MCP Agent TypeScript Examples

This directory contains examples demonstrating how to use the MCP Agent TypeScript framework.

## Basic Examples

- **basic_agent.ts**: A simple example showing how to create and use a basic agent.

## Workflow Examples

- **workflow_example.ts**: Demonstrates the different workflow patterns (Router, Parallel, Orchestrator) available in the framework.

## Orchestrator Examples

- **orchestrator_comparison.ts**: Compares the full planning and iterative planning modes of the Orchestrator workflow on different types of tasks.
- **orchestrator_iterative_planning.ts**: A detailed example showing how iterative planning adapts based on previous results for a renewable energy research task.
- **orchestrator_error_handling.ts**: Demonstrates how to handle errors in the Orchestrator workflow and how iterative planning can help with error recovery.
- **orchestrator_custom_planner.ts**: Shows how to use a custom planner with the Orchestrator workflow for more specialized planning.
- **workflow_orchestrator_worker/main.ts**: A TypeScript implementation of the student assignment grader example, demonstrating both planning modes.

## Running the Examples

To run an example, use the following command:

```bash
# Build the project first
npm run build

# Run an example
npx tsx examples/basic_agent.ts
npx tsx examples/workflow_example.ts

# Run Orchestrator examples
npx tsx examples/orchestrator_comparison.ts
npx tsx examples/orchestrator_iterative_planning.ts
npx tsx examples/orchestrator_error_handling.ts
npx tsx examples/orchestrator_custom_planner.ts
npx tsx examples/workflow_orchestrator_worker/main.ts
```

## Orchestrator Planning Modes

The Orchestrator workflow supports two planning modes:

### Full Planning Mode

In full planning mode, the Orchestrator:

1. Generates a complete plan upfront with all steps and dependencies
2. Executes the steps in the plan, respecting dependencies
3. Summarizes the results

This mode is best for tasks where:

- The entire workflow can be determined in advance
- Steps have clear dependencies
- The task is well-defined and doesn't require adaptation

### Iterative Planning Mode

In iterative planning mode, the Orchestrator:

1. Generates only the next step based on the current state
2. Executes that step
3. Uses the result to determine the next step
4. Continues until the task is complete
5. Summarizes the results

This mode is best for tasks where:

- The next steps depend heavily on the results of previous steps
- The full workflow cannot be determined in advance
- Adaptation is required based on intermediate results
- Error recovery and course correction are important

## Example Tasks

The examples include various tasks to demonstrate the different planning modes:

- Simple tasks (blog posts, short summaries)
- Complex tasks (comprehensive guides, detailed reports)
- Adaptive tasks (research that requires following leads, tasks with unknown paths)

Each example includes analysis of which planning mode is more suitable for the given task.

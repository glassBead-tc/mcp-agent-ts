# Orchestrator Workflow Example

This example shows an Orchestrator workflow which dynamically plans across a number of agents to accomplish a multi-step task.

It parallelizes the task executions where possible, and continues execution until the objective is attained.

This particular example is a student assignment grader, which requires:

- Finding the student's assignment in a short_story.md on disk (using file system functions)
- Using proofreader, fact checker and style enforcer agents to evaluate the quality of the report
- The style enforcer requires reading style guidelines from the APA website using fetch functions
- Writing the graded report to disk (using file system functions)

<img width="1650" alt="Image" src="https://github.com/user-attachments/assets/12263f81-f2f8-41e2-a758-13d764f782a1" />

## Implementation

This example is available in both Python and TypeScript:

- `main.py`: Python implementation using MCP servers
- `main.ts`: TypeScript implementation using function calls

## Planning Modes

The TypeScript implementation demonstrates both planning modes of the Orchestrator workflow:

### Full Planning Mode

In full planning mode, the Orchestrator generates a complete plan upfront with all steps and dependencies, then executes the steps in order, respecting dependencies.

```typescript
const orchestratorFull = new Orchestrator({
  availableAgents: [
    finderAgent,
    writerAgent,
    proofreaderAgent,
    factCheckerAgent,
    styleEnforcerAgent,
  ],
  llmFactory,
  planType: "full", // Use full planning mode (this is the default)
});
```

### Iterative Planning Mode

In iterative planning mode, the Orchestrator generates only the next step based on the current state, executes that step, and uses the result to determine the next step. This continues until the task is complete.

```typescript
const orchestratorIterative = new Orchestrator({
  availableAgents: [
    finderAgent,
    writerAgent,
    proofreaderAgent,
    factCheckerAgent,
    styleEnforcerAgent,
  ],
  llmFactory,
  planType: "iterative", // Use iterative planning mode
});
```

## Running the Example

### Python Version

```bash
python main.py
```

### TypeScript Version

```bash
npx tsx main.ts
```

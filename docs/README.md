# MCP Agent TypeScript Documentation

This documentation provides an overview of the MCP Agent TypeScript framework, which is a port of the Python MCP Agent framework.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Workflow Patterns](#workflow-patterns)
- [Advanced Features](#advanced-features)
- [Usage Telemetry](#usage-telemetry)
- [Examples](#examples)

## Overview

MCP Agent TypeScript is a framework for building effective agents with Model Context Protocol (MCP) using simple, composable patterns. It provides a set of tools and patterns for building agents that can interact with LLMs and other services using the Model Context Protocol.

## Core Components

### MCPApp

The `MCPApp` class is the main entry point for the framework. It provides global state and app configuration.

```typescript
import { MCPApp } from "mcp-agent-ts/app";

// Create app
const app = new MCPApp({
  name: "my-app",
});

// Run the app
await app.run(async (app) => {
  // Use the app...
});
```

### Agent

The `Agent` class represents an entity that has access to a set of MCP servers and exposes them to an LLM as tool calls. It has a name and purpose defined by its instruction.

```typescript
import { Agent } from "mcp-agent-ts/agents/agent";

// Create agent
const agent = new Agent({
  name: "my-agent",
  instruction: "You are a helpful agent.",
  serverNames: ["fetch", "filesystem"],
  functions: [getCurrentTime, getWeather],
});

// Initialize agent
await agent.initialize();

// Use the agent...

// Shutdown agent
await agent.shutdown();
```

### AugmentedLLM

The `AugmentedLLM` class is an LLM that is enhanced with tools provided from a collection of MCP servers. Every workflow pattern is an `AugmentedLLM` itself, allowing you to compose and chain them together.

```typescript
import { OpenAIAugmentedLLM } from "mcp-agent-ts/workflows/llm";

// Create LLM
const llm = await agent.attachLLM(async (agent) => {
  return new OpenAIAugmentedLLM({
    agent,
    model: "gpt-4o",
  });
});

// Use the LLM
const result = await llm.complete([
  { role: "user", content: "What time is it?" },
]);
```

## Workflow Patterns

### Router

The Router pattern routes requests to the most appropriate agent or function based on the content of the request.

```typescript
import { LLMRouter } from "mcp-agent-ts/workflows/router";

// Create router
const router = new LLMRouter({
  llm: await llmFactory(summarizerAgent),
  agents: [researchAgent, writerAgent, editorAgent, factCheckerAgent],
  functions: [getCurrentTime, getWeather],
});

// Route request
const routingResults = await router.route("What is the current time?", 1);

// Use the result
const selectedAgent = routingResults[0].result;
```

### Parallel

The Parallel pattern distributes a task to multiple agents in parallel and then aggregates the results.

```typescript
import { ParallelLLM } from "mcp-agent-ts/workflows/parallel";

// Create parallel LLM
const parallel = new ParallelLLM({
  fanOutAgents: [researchAgent, factCheckerAgent],
  fanInAgent: summarizerAgent,
  llmFactory,
});

// Run parallel workflow
const result = await parallel.complete([
  { role: "user", content: "What is the weather like in New York and London?" },
]);
```

### Orchestrator

The Orchestrator pattern generates a plan for a complex task, executes the steps in the plan using specialized agents, and then summarizes the results. It supports two planning modes:

- **Full Planning**: Generates a complete plan upfront and then executes it.
- **Iterative Planning**: Generates and executes one step at a time, adapting based on the results of previous steps.

```typescript
import { Orchestrator } from "mcp-agent-ts/workflows/orchestrator";

// Create orchestrator with full planning (default)
const orchestrator = new Orchestrator({
  availableAgents: [
    researchAgent,
    writerAgent,
    editorAgent,
    factCheckerAgent,
    summarizerAgent,
  ],
  llmFactory,
  planType: "full", // Optional, 'full' is the default
});

// Or create orchestrator with iterative planning
const iterativeOrchestrator = new Orchestrator({
  availableAgents: [
    researchAgent,
    writerAgent,
    editorAgent,
    factCheckerAgent,
    summarizerAgent,
  ],
  llmFactory,
  planType: "iterative",
});

// Run orchestrator workflow
const result = await orchestrator.complete([
  {
    role: "user",
    content: "Write a short blog post about the weather in different cities.",
  },
]);
```

Iterative planning is useful for complex tasks where the next steps depend on the results of previous steps, or when the full plan cannot be determined upfront.

## Advanced Features

### Human Input

The framework supports requesting input from a human user during a workflow.

```typescript
import { consoleInputCallback } from "mcp-agent-ts/human_input/handler";

// Create agent with human input callback
const agent = new Agent({
  name: "my-agent",
  instruction: "You are a helpful agent.",
  humanInputCallback: consoleInputCallback,
});

// Request human input
const result = await agent.requestHumanInput({
  prompt: "What is your name?",
  description: "I need to know your name to personalize the response.",
  timeout_seconds: 300,
});
```

### Composability

All workflow patterns are implemented as `AugmentedLLM` instances, which means they can be composed together to create more complex workflows.

```typescript
// Use a ParallelLLM as the planner for an Orchestrator
const planner = new ParallelLLM({
  fanOutAgents: [researchAgent, factCheckerAgent],
  fanInAgent: summarizerAgent,
  llmFactory,
});

const orchestrator = new Orchestrator({
  availableAgents: [
    researchAgent,
    writerAgent,
    editorAgent,
    factCheckerAgent,
    summarizerAgent,
  ],
  llmFactory,
  planner,
});
```

## Usage Telemetry

MCP Agent anonymously collects usage metrics to help improve the product. The
`usage_telemetry` section of your configuration controls this behaviour and is
enabled by default:

```yaml
usage_telemetry:
  enabled: true
  enable_detailed_telemetry: false
```

Set `enabled` to `false` to disable all telemetry reporting.

## Examples

See the `examples` directory for more examples of how to use the framework.

- `examples/basic_agent.ts`: A basic agent example
- `examples/workflow_example.ts`: An example that demonstrates the different workflow patterns

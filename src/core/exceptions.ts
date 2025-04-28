/**
 * Custom exceptions for the mcp-agent library.
 * Enables user-friendly error handling for common issues.
 */

export class MCPAgentError extends Error {
  details: string;

  constructor(message: string, details: string = "") {
    super(details ? `${message}\n\n${details}` : message);
    this.name = "MCPAgentError";
    this.details = details;
    this.message = message;
  }
}

export class ServerConfigError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "ServerConfigError";
  }
}

export class AgentConfigError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "AgentConfigError";
  }
}

export class ProviderKeyError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "ProviderKeyError";
  }
}

export class ServerInitializationError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "ServerInitializationError";
  }
}

export class ModelConfigError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "ModelConfigError";
  }
}

export class CircularDependencyError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "CircularDependencyError";
  }
}

export class PromptExitError extends MCPAgentError {
  constructor(message: string, details: string = "") {
    super(message, details);
    this.name = "PromptExitError";
  }
}
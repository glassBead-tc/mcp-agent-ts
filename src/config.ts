/**
 * Configuration module for MCP Agent
 * Handles loading and managing settings from files or environment
 */
import { getLogger } from "./logging/logger.js";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const logger = getLogger("config");

/**
 * Logger settings
 */
export interface LoggerSettings {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  format?: "pretty" | "json";
  destination?: "console" | "file";
  file?: string;
}

/**
 * Server settings
 */
export interface ServerSettings {
  id: string;
  url: string;
  description?: string;
  apiKey?: string;
  auth?: {
    type: string;
    [key: string]: any;
  };
  options?: Record<string, any>;
}

/**
 * MCP settings
 */
export interface MCPSettings {
  servers?: Record<string, ServerSettings>;
  defaultServer?: string;
}

/**
 * Workflow settings
 */
export interface WorkflowSettings {
  engine?: string;
  options?: Record<string, any>;
}

/**
 * Application settings
 */
export interface Settings {
  appName?: string;
  configPath?: string;
  logger?: LoggerSettings;
  mcp?: MCPSettings;
  workflow?: WorkflowSettings;
  [key: string]: any;
}

// Global settings
let globalSettings: Settings = {
  appName: "mcp-agent",
  logger: {
    level: "info",
    format: "pretty",
    destination: "console",
  },
  mcp: {
    servers: {},
  },
  workflow: {
    engine: "local",
  },
};

/**
 * Load settings from a file
 */
export function loadSettingsFromFile(filePath: string): Settings {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`Config file not found: ${filePath}`);
      return {};
    }

    // Read file
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const fileExt = path.extname(filePath).toLowerCase();

    // Parse based on file extension
    let parsedConfig: any;
    if (fileExt === ".json") {
      parsedConfig = JSON.parse(fileContent);
    } else if (fileExt === ".yaml" || fileExt === ".yml") {
      parsedConfig = yaml.load(fileContent);
    } else {
      throw new Error(`Unsupported config file format: ${fileExt}`);
    }

    logger.debug(`Loaded config from ${filePath}`);
    return parsedConfig as Settings;
  } catch (error) {
    logger.error(`Error loading config from ${filePath}`, { error });
    return {};
  }
}

/**
 * Initialize settings
 */
export function initializeSettings(options: Settings = {}): Settings {
  // Start with default settings
  const settings: Settings = { ...globalSettings };

  // Try to load from config file if specified
  if (options.configPath) {
    const fileSettings = loadSettingsFromFile(options.configPath);
    Object.assign(settings, fileSettings);
  }

  // Override with any options passed directly
  Object.assign(settings, options);

  // Apply environment variables
  if (process.env.MCP_LOG_LEVEL) {
    settings.logger = settings.logger || {};
    settings.logger.level = process.env.MCP_LOG_LEVEL as any;
  }

  if (process.env.MCP_API_KEY) {
    // Apply to all servers
    if (settings.mcp?.servers) {
      Object.values(settings.mcp.servers).forEach((server) => {
        server.apiKey = server.apiKey || process.env.MCP_API_KEY;
      });
    }
  }

  // Update global settings
  globalSettings = settings;

  return settings;
}

/**
 * Get the current settings
 */
export function getSettings(): Settings {
  return { ...globalSettings };
}

/**
 * Update settings
 */
export function updateSettings(newSettings: Partial<Settings>): Settings {
  Object.assign(globalSettings, newSettings);
  return { ...globalSettings };
}

/**
 * Configuration management for MCP Agent
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import YAML from 'yaml';
import { ExecutionEngine, LogLevel } from '../types.js';

export const OpenAIConfigSchema = z
  .object({
    api_key: z.string().optional(),
    reasoning_effort: z.enum(['low', 'medium', 'high']).default('medium'),
    base_url: z.string().optional(),
    user: z.string().optional(),
    default_headers: z.record(z.string()).optional(),
    default_model: z.string().optional(),
  })
  .passthrough();

export const AnthropicConfigSchema = z
  .object({
    api_key: z.string().optional(),
  })
  .passthrough();

export const UsageTelemetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  enable_detailed_telemetry: z.boolean().default(false),
});

// Define configuration schema using Zod
export const LoggerConfigSchema = z.object({
  level: z.nativeEnum(LogLevel).default(LogLevel.INFO),
  format: z.enum(['json', 'pretty']).default('pretty'),
  output: z.enum(['console', 'file']).default('console'),
  file_path: z.string().optional(),
  batch_size: z.number().default(100),
  flush_interval: z.number().default(5),
});

export const OtelConfigSchema = z.object({
  enabled: z.boolean().default(false),
  service_name: z.string().default('mcp-agent-ts'),
  service_instance_id: z.string().optional(),
  service_version: z.string().optional(),
  otlp_endpoint: z.string().optional(),
  console_debug: z.boolean().default(false),
});

export const TemporalConfigSchema = z.object({
  address: z.string().default('localhost:7233'),
  namespace: z.string().default('default'),
  task_queue: z.string().default('mcp-agent-ts'),
  worker_options: z.record(z.any()).default({}),
});

export const SettingsSchema = z
  .object({
    execution_engine: z
      .nativeEnum(ExecutionEngine)
      .default(ExecutionEngine.ASYNCIO),
    logger: LoggerConfigSchema.default({}),
    otel: OtelConfigSchema.default({}),
    temporal: TemporalConfigSchema.default({}),
    mcp_servers: z.record(z.any()).default({}),
    openai: OpenAIConfigSchema.optional(),
    anthropic: AnthropicConfigSchema.optional(),
    usage_telemetry: UsageTelemetryConfigSchema.optional(),
  })
  .passthrough();

export type LoggerConfig = z.infer<typeof LoggerConfigSchema>;
export type OtelConfig = z.infer<typeof OtelConfigSchema>;
export type TemporalConfig = z.infer<typeof TemporalConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

// Default configuration
const DEFAULT_CONFIG: Settings = {
  execution_engine: ExecutionEngine.ASYNCIO,
  logger: {
    level: LogLevel.INFO,
    format: 'pretty',
    output: 'console',
    batch_size: 100,
    flush_interval: 5,
  },
  otel: {
    enabled: false,
    service_name: 'mcp-agent-ts',
    console_debug: false,
  },
  temporal: {
    address: 'localhost:7233',
    namespace: 'default',
    task_queue: 'mcp-agent-ts',
    worker_options: {},
  },
  mcp_servers: {},
  openai: {},
  anthropic: {},
  usage_telemetry: { enabled: true, enable_detailed_telemetry: false },
};

// Global settings instance
let _settings: Settings | null = null;

function deepMerge(target: any, source: any): any {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export function loadSecretsFromFile(filePath: string): Record<string, any> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return YAML.parse(fileContent) || {};
  } catch {
    return {};
  }
}

/**
 * Load settings from a YAML file
 */
export function loadSettingsFromFile(filePath: string): Settings {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedConfig = YAML.parse(fileContent);
    const merged = deepMerge({ ...DEFAULT_CONFIG }, parsedConfig || {});
    const dir = path.dirname(filePath);
    for (const name of ['mcp_agent.secrets.yaml', 'mcp_agent.secrets.yml']) {
      const secretsPath = path.join(dir, name);
      if (fs.existsSync(secretsPath)) {
        const secrets = loadSecretsFromFile(secretsPath);
        deepMerge(merged, secrets);
        break;
      }
    }
    return SettingsSchema.parse(merged);
  } catch (error) {
    console.warn(`Failed to load config from ${filePath}:`, error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the current settings, loading from file if necessary
 */
export function getSettings(): Settings {
  if (_settings) {
    return _settings;
  }

  // Try to load from environment variable
  const configPath = process.env.MCP_AGENT_CONFIG_PATH;
  if (configPath) {
    _settings = loadSettingsFromFile(configPath);
    return _settings;
  }

  // Try to load from default locations
  const defaultLocations = [
    'mcp_agent.yaml',
    'mcp_agent.yml',
    path.join(process.cwd(), 'mcp_agent.yaml'),
    path.join(process.cwd(), 'mcp_agent.yml'),
    path.join(process.env.HOME || '', '.mcp_agent.yaml'),
    path.join(process.env.HOME || '', '.mcp_agent.yml'),
  ];

  for (const location of defaultLocations) {
    if (fs.existsSync(location)) {
      _settings = loadSettingsFromFile(location);
      return _settings;
    }
  }

  // Look for standalone secrets file
  const secretLocations = [
    'mcp_agent.secrets.yaml',
    'mcp_agent.secrets.yml',
    path.join(process.cwd(), 'mcp_agent.secrets.yaml'),
    path.join(process.cwd(), 'mcp_agent.secrets.yml'),
    path.join(process.env.HOME || '', '.mcp_agent.secrets.yaml'),
    path.join(process.env.HOME || '', '.mcp_agent.secrets.yml'),
  ];

  for (const secretPath of secretLocations) {
    if (fs.existsSync(secretPath)) {
      const secrets = loadSecretsFromFile(secretPath);
      const merged = deepMerge({ ...DEFAULT_CONFIG }, secrets);
      _settings = SettingsSchema.parse(merged);
      return _settings;
    }
  }

  // Return default settings if no file found
  _settings = DEFAULT_CONFIG;
  return _settings;
}

/**
 * Update the current settings
 */
export function updateSettings(newSettings: Partial<Settings>): Settings {
  const currentSettings = getSettings();
  _settings = deepMerge({ ...currentSettings }, newSettings);
  return _settings;
}

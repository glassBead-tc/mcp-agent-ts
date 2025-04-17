/**
 * Configuration management for MCP Agent
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import YAML from 'yaml';
import { ExecutionEngine, LogLevel } from '../types';

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

export const SettingsSchema = z.object({
  execution_engine: z.nativeEnum(ExecutionEngine).default(ExecutionEngine.ASYNCIO),
  logger: LoggerConfigSchema.default({}),
  otel: OtelConfigSchema.default({}),
  temporal: TemporalConfigSchema.default({}),
  mcp_servers: z.record(z.any()).default({}),
});

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
};

// Global settings instance
let _settings: Settings | null = null;

/**
 * Load settings from a YAML file
 */
export function loadSettingsFromFile(filePath: string): Settings {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedConfig = YAML.parse(fileContent);
    return SettingsSchema.parse({
      ...DEFAULT_CONFIG,
      ...parsedConfig,
    });
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

  // Return default settings if no file found
  _settings = DEFAULT_CONFIG;
  return _settings;
}

/**
 * Update the current settings
 */
export function updateSettings(newSettings: Partial<Settings>): Settings {
  const currentSettings = getSettings();
  _settings = {
    ...currentSettings,
    ...newSettings,
  };
  return _settings;
}

/**
 * Configuration management for MCP Agent
 *
 * Provides a way to load and access application settings.
 */

/**
 * Settings class for MCP Agent
 *
 * Manages application configuration settings.
 */
export class Settings {
  private config: Record<string, any>;

  /**
   * Create a new settings instance
   *
   * @param config - Configuration object or path to config file
   */
  constructor(config: Record<string, any> | string) {
    if (typeof config === "string") {
      // Load config from file if string is provided
      try {
        const fs = require("fs");
        const yaml = require("js-yaml");
        const content = fs.readFileSync(config, "utf8");
        this.config = yaml.load(content);
      } catch (error) {
        console.error(`Error loading config file: ${error}`);
        this.config = {};
      }
    } else {
      // Use provided config object
      this.config = config || {};
    }
  }

  /**
   * Get a setting value by key
   *
   * @param key - The setting key to retrieve
   * @param defaultValue - Default value if setting is not found
   * @returns The setting value or default value
   */
  get<T>(key: string, defaultValue?: T): T {
    const parts = key.split(".");
    let value: any = this.config;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return defaultValue as T;
      }
      value = value[part];
    }

    return value !== undefined && value !== null ? value : (defaultValue as T);
  }

  /**
   * Check if a setting exists
   *
   * @param key - The setting key to check
   * @returns True if the setting exists
   */
  has(key: string): boolean {
    const parts = key.split(".");
    let value: any = this.config;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return false;
      }
      value = value[part];
    }

    return value !== undefined && value !== null;
  }

  /**
   * Get all settings
   *
   * @returns The complete configuration object
   */
  getAll(): Record<string, any> {
    return { ...this.config };
  }
}

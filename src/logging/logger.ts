/**
 * Logging system for MCP Agent
 */
import pino from 'pino';
import { LogLevel } from '../types.js';
import { getSettings, LoggerConfig } from '../config.js';

// Map our log levels to pino log levels
const LOG_LEVEL_MAP: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARNING]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.CRITICAL]: 'fatal',
};

// Global logger instance
let _logger: pino.Logger | null = null;

/**
 * Configure the logger based on settings
 */
export function configureLogger(config?: LoggerConfig): pino.Logger {
  const settings = config || getSettings().logger;
  
  const options: pino.LoggerOptions = {
    level: LOG_LEVEL_MAP[settings.level] || 'info',
  };

  // Configure transport based on settings
  if (settings.format === 'pretty') {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    };
  }

  // Create the logger
  const logger = pino(options);
  
  // Store as global instance
  _logger = logger;
  
  return logger;
}

/**
 * Get a logger instance for a specific module
 */
export function getLogger(name: string): pino.Logger {
  if (!_logger) {
    _logger = configureLogger();
  }
  
  return _logger.child({ name });
}

/**
 * Logging configuration class
 */
export class LoggingConfig {
  private static _instance: LoggingConfig;
  private _logger: pino.Logger;

  private constructor() {
    this._logger = configureLogger();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LoggingConfig {
    if (!LoggingConfig._instance) {
      LoggingConfig._instance = new LoggingConfig();
    }
    return LoggingConfig._instance;
  }

  /**
   * Configure the logging system
   */
  public static async configure(options: {
    level?: LogLevel;
    format?: 'json' | 'pretty';
    transport?: any;
    batch_size?: number;
    flush_interval?: number;
  }): Promise<void> {
    const instance = LoggingConfig.getInstance();
    
    // Update logger configuration
    const config: LoggerConfig = {
      level: options.level || getSettings().logger.level,
      format: options.format || getSettings().logger.format,
      output: 'console',
      batch_size: options.batch_size || getSettings().logger.batch_size,
      flush_interval: options.flush_interval || getSettings().logger.flush_interval,
    };
    
    instance._logger = configureLogger(config);
    _logger = instance._logger;
  }

  /**
   * Shutdown the logging system
   */
  public static async shutdown(): Promise<void> {
    // Flush any pending logs
    await new Promise<void>((resolve) => {
      if (_logger) {
        _logger.flush(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

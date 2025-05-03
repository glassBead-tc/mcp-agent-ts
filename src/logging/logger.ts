/**
 * Simple logging module for MCP Agent.
 * This module is intended to be used for logging within the MCP Agent itself.
 * For logging in user code, use the `Logger` class from the `mcp_agent` module.
 */

export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export interface LoggerConfig {
  level?: LogLevel;
}

/**
 * Simple Logger class that uses console for logging
 */
export class Logger {
  private name: string;
  private level: LogLevel;

  constructor(name: string, config: LoggerConfig = {}) {
    this.name = name;
    this.level = config.level || LogLevel.INFO;
  }

  private formatMessage(
    level: string,
    message: string,
    data?: Record<string, any>
  ): string {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${
      this.name
    }] ${message}`;

    if (data && Object.keys(data).length > 0) {
      formattedMessage += " " + JSON.stringify(data);
    }

    return formattedMessage;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = {
      [LogLevel.TRACE]: 0,
      [LogLevel.DEBUG]: 1,
      [LogLevel.INFO]: 2,
      [LogLevel.WARN]: 3,
      [LogLevel.ERROR]: 4,
      [LogLevel.FATAL]: 5,
    };

    return levels[level] >= levels[this.level];
  }

  trace(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.debug(this.formatMessage("trace", message, data));
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage("debug", message, data));
    }
  }

  info(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage("info", message, data));
    }
  }

  warn(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage("warn", message, data));
    }
  }

  error(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage("error", message, data));
    }
  }

  fatal(message: string, data?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      console.error(this.formatMessage("fatal", message, data));
    }
  }
}

// Logger instances cache
const loggers: Map<string, Logger> = new Map();

/**
 * Get a logger instance
 * @param name Logger name
 * @returns Logger instance
 */
export function getLogger(name: string): Logger {
  if (!loggers.has(name)) {
    // Create new logger with default config
    loggers.set(name, new Logger(name));
  }

  return loggers.get(name)!;
}

/**
 * Centralized console configuration for MCP Agent.
 *
 * This module provides shared console instances for consistent output handling:
 * - mainConsole: Main console for general output
 * - errorConsole: Error console for application errors (writes to stderr)
 * - serverConsole: Special console for MCP server output
 */

import chalk from 'chalk';

/**
 * Console interface with styling methods
 */
export interface StyledConsole {
  log: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

/**
 * Main console for general output
 */
export const mainConsole: StyledConsole = {
  log: (message: string, ...args: any[]) => console.log(message, ...args),
  error: (message: string, ...args: any[]) => console.error(chalk.red(message), ...args),
  warn: (message: string, ...args: any[]) => console.warn(chalk.yellow(message), ...args),
  info: (message: string, ...args: any[]) => console.info(chalk.blue(message), ...args),
  debug: (message: string, ...args: any[]) => console.debug(chalk.gray(message), ...args),
};

/**
 * Error console for application errors
 */
export const errorConsole: StyledConsole = {
  log: (message: string, ...args: any[]) => console.error(chalk.red.bold(message), ...args),
  error: (message: string, ...args: any[]) => console.error(chalk.red.bold(message), ...args),
  warn: (message: string, ...args: any[]) => console.error(chalk.red.bold(message), ...args),
  info: (message: string, ...args: any[]) => console.error(chalk.red.bold(message), ...args),
  debug: (message: string, ...args: any[]) => console.error(chalk.red.bold(message), ...args),
};

/**
 * Special console for MCP server output
 */
export const serverConsole: StyledConsole = {
  log: (message: string, ...args: any[]) => console.log(chalk.dim.blue(message), ...args),
  error: (message: string, ...args: any[]) => console.error(chalk.dim.blue(message), ...args),
  warn: (message: string, ...args: any[]) => console.warn(chalk.dim.blue(message), ...args),
  info: (message: string, ...args: any[]) => console.info(chalk.dim.blue(message), ...args),
  debug: (message: string, ...args: any[]) => console.debug(chalk.dim.blue(message), ...args),
};
import { mainConsole, errorConsole, StyledConsole } from '../console.js';
import chalk from 'chalk';

/**
 * Terminal application with logging functionality
 */
export class Application {
  verbosity: number;
  console: StyledConsole;
  errorConsole: StyledConsole;
  colorEnabled: boolean;

  /**
   * Initialize a terminal application
   * 
   * @param verbosity - Level of verbosity (0 = normal, >0 = debug)
   * @param enableColor - Whether to enable color output
   */
  constructor(verbosity: number = 0, enableColor: boolean = true) {
    this.verbosity = verbosity;
    this.colorEnabled = enableColor;
    
    if (!enableColor) {
      // Disable colors if requested
      chalk.level = 0;
    }
    
    this.console = mainConsole;
    this.errorConsole = errorConsole;
  }

  /**
   * Log a message to the console
   * 
   * @param message - Message to log
   * @param level - Log level (info, debug, error)
   */
  log(message: string, level: string = 'info'): void {
    if (level === 'info' || (level === 'debug' && this.verbosity > 0)) {
      if (level === 'error') {
        this.errorConsole.log(`[${level.toUpperCase()}] ${message}`);
      } else if (level === 'debug') {
        this.console.debug(`[${level.toUpperCase()}] ${message}`);
      } else if (level === 'warn') {
        this.console.warn(`[${level.toUpperCase()}] ${message}`);
      } else {
        this.console.info(`[${level.toUpperCase()}] ${message}`);
      }
    }
  }

  /**
   * Create a status message
   * 
   * @param message - Status message to display
   */
  status(message: string): void {
    this.console.info(this.colorEnabled ? chalk.cyan.bold(message) : message);
  }
}
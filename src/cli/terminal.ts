import { console, errorConsole } from '../console';
import { Console } from 'rich';

/**
 * Terminal application with logging functionality
 */
export class Application {
  verbosity: number;
  console: Console;
  errorConsole: Console;

  /**
   * Initialize a terminal application
   * 
   * @param verbosity - Level of verbosity (0 = normal, >0 = debug)
   * @param enableColor - Whether to enable color output
   */
  constructor(verbosity: number = 0, enableColor: boolean = true) {
    this.verbosity = verbosity;
    
    // Use the central console instances, respecting color setting
    if (!enableColor) {
      // Create new instances without color if color is disabled
      this.console = new Console({ colorSystem: null });
      this.errorConsole = new Console({ colorSystem: null, stderr: true });
    } else {
      this.console = console;
      this.errorConsole = errorConsole;
    }
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
        this.errorConsole.print(`[${level.toUpperCase()}] ${message}`);
      } else {
        this.console.print(`[${level.toUpperCase()}] ${message}`);
      }
    }
  }

  /**
   * Create a status spinner with the given message
   * 
   * @param message - Status message to display
   * @returns A status context manager
   */
  status(message: string) {
    return this.console.status(`[bold cyan]${message}[/bold cyan]`);
  }
}
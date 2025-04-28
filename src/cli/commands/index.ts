/**
 * Command registry for MCP Agent CLI
 */
import { Command } from 'commander';
import { configCommand } from './config';

/**
 * Register all CLI commands with the program
 * 
 * @param program - The Commander program instance
 */
export function registerCommands(program: Command): void {
  // Add the config command
  program.addCommand(configCommand);
  
  // Additional commands can be registered here as they're implemented
  // For example:
  // program.addCommand(runCommand);
  // program.addCommand(serverCommand);
}

// Export all commands
export { configCommand };

// You can add additional command exports here as they're implemented
// export { runCommand };
// export { serverCommand };
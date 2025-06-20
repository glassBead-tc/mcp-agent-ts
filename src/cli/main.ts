/**
 * CLI for MCP Agent
 */
import { Command } from 'commander';
import * as readline from 'readline';
import { getSettings, updateSettings } from '../config/index.js';
import { getLogger } from '../logging/logger.js';
import { LogLevel } from '../types.js';
import { MCPApp } from '../app.js';
import { Agent } from '../agents/agent.js';
import { Message, OpenAIAugmentedLLM } from '../workflows/llm/index.js';
import { configCommand } from './commands/config.js';
import { Application } from './terminal.js';

const logger = getLogger('cli');

/**
 * Create the CLI program
 */
export function createProgram(): Command {
  const program = new Command();
  
  program
    .name('mcp-agent')
    .description('MCP Agent CLI')
    .version('0.0.1')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--no-color', 'Disable color output');
  
  // Add imported config command
  program.addCommand(configCommand);
  
  // Config get command
  configCommand.command('get')
    .description('Get configuration')
    .option('-k, --key <key>', 'Configuration key')
    .action((options) => {
      const config = getSettings();
      
      if (options.key) {
        // Get specific key
        const keys = options.key.split('.');
        let value: any = config;
        
        for (const key of keys) {
          if (value === undefined || value === null) {
            console.log(`Configuration key ${options.key} not found`);
            return;
          }
          
          value = value[key];
        }
        
        console.log(`${options.key}:`, value);
      } else {
        // Get all config
        console.log(JSON.stringify(config, null, 2));
      }
    });
  
  // Config set command
  configCommand.command('set')
    .description('Set configuration')
    .requiredOption('-k, --key <key>', 'Configuration key')
    .requiredOption('-v, --value <value>', 'Configuration value')
    .action((options) => {
      const config = getSettings();
      
      // Set specific key
      const keys = options.key.split('.');
      let current: any = config;
      
      // Navigate to the parent object
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        
        if (current[key] === undefined) {
          current[key] = {};
        }
        
        current = current[key];
      }
      
      // Set the value
      const lastKey = keys[keys.length - 1];
      
      // Try to parse the value
      let value: any;
      try {
        value = JSON.parse(options.value);
      } catch (error) {
        value = options.value;
      }
      
      current[lastKey] = value;
      
      // Update settings
      updateSettings(config);
      
      console.log(`Set ${options.key} to ${options.value}`);
    });
  
  // Run command
  program.command('run')
    .description('Run an agent')
    .requiredOption('-n, --name <name>', 'Agent name')
    .option('-i, --instruction <instruction>', 'Agent instruction')
    .option('-s, --servers <servers>', 'Comma-separated list of server names')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (options) => {
      // Set log level
      if (options.verbose) {
        updateSettings({
          logger: {
            level: LogLevel.DEBUG,
          },
        });
      }

      // Parse servers
      const servers = options.servers ? options.servers.split(',') : [];

      // Run agent
      console.log(`Running agent ${options.name}`);
      console.log(`Instruction: ${options.instruction || 'You are a helpful agent.'}`);
      console.log(`Servers: ${servers.join(', ') || 'None'}`);

      // Instantiate app and agent
      const app = new MCPApp({ name: options.name });

      await app.run(async (app) => {
        const agent = new Agent({
          name: options.name,
          instruction: options.instruction || 'You are a helpful agent.',
          serverNames: servers,
          context: app.context,
        });

        await agent.initialize();

        // Attach a basic LLM
        const llm = await agent.attachLLM(async (a) =>
          new OpenAIAugmentedLLM({ agent: a })
        );

        // Simple conversation loop
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const question = (prompt: string) =>
          new Promise<string>((resolve) => rl.question(prompt, resolve));

        let messages: Message[] = [
          { role: 'system', content: agent.instruction as string },
        ];

        while (true) {
          const input = (await question('You: ')).trim();
          if (input.toLowerCase() === 'exit') {
            break;
          }
          messages.push({ role: 'user', content: input });
          messages = await llm.runConversation(messages);
          const last = messages[messages.length - 1];
          if (last.role === 'assistant') {
            console.log(`Assistant: ${last.content}`);
          }
        }

        rl.close();
        await agent.shutdown();
      });
    });
  
  return program;
}

/**
 * Run the CLI
 */
export function runCLI(): void {
  const program = createProgram();
  
  // Parse arguments
  program.parse(process.argv);
  
  // Create terminal application with appropriate verbosity and color settings
  const options = program.opts();
  const terminal = new Application(
    options.verbose ? 1 : 0,
    !options.noColor
  );
  
  // Set terminal in global context
  // In a real implementation, this would be part of the context setup
  (global as any).terminal = terminal;
}

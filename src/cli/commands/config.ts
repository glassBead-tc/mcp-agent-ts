import { Command } from 'commander';

export const configCommand = new Command('config')
  .description('Configuration commands');

configCommand
  .command('show')
  .description('Show the configuration')
  .action(() => {
    throw new Error('The show configuration command has not been implemented yet');
  });
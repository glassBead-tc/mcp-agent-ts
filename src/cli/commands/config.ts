import { Command } from 'commander';
import { getSettings } from '../../config/index.js';

export const configCommand = new Command('config')
  .description('Configuration commands');

configCommand
  .command('show')
  .description('Show the configuration')
  .action(() => {
    const config = getSettings();
    console.log(JSON.stringify(config, null, 2));
  });
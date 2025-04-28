/**
 * Human input handler for MCP Agent
 */
import * as readline from 'readline';
import { HumanInputCallback, HumanInputRequest, HumanInputResponse } from '../types.js';
import { getLogger } from '../logging/logger.js';

const logger = getLogger('human_input');

/**
 * Console input callback for handling human input
 */
export const consoleInputCallback: HumanInputCallback = async (
  request: HumanInputRequest
): Promise<HumanInputResponse> => {
  logger.debug('Requesting human input', { request });
  
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  // Display the prompt
  console.log('\n=== Human Input Required ===');
  console.log(request.prompt);
  if (request.description) {
    console.log(request.description);
  }
  
  // Create a promise that resolves with the user's input
  const result = await new Promise<string>((resolve) => {
    rl.question('> ', (answer) => {
      resolve(answer);
      rl.close();
    });
  });
  
  logger.debug('Received human input', { result });
  
  return {
    text: result,
    metadata: {
      timestamp: new Date().toISOString(),
      request_id: request.request_id,
    },
  };
};

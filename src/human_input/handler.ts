/**
 * Human input handler module
 * Provides mechanisms for getting input from humans during workflow execution
 */
import { getLogger } from "../logging/logger.js";
import { HumanInputCallback, HumanInputOptions } from "../types.js";
import readline from "readline";

const logger = getLogger("human-input");

/**
 * Console-based human input implementation
 * This is a simple implementation that prompts users in the console
 */
export const consoleInputCallback: HumanInputCallback = async (
  prompt: string,
  options: HumanInputOptions = {}
): Promise<string> => {
  const { timeout = 0, description = "" } = options;

  logger.info(`Requesting human input: ${prompt}`, {
    description,
    timeout: timeout > 0 ? `${timeout}ms` : "no timeout",
  });

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Format prompt
  let formattedPrompt = `\n[HUMAN INPUT REQUIRED]`;
  if (description) {
    formattedPrompt += `\nContext: ${description}`;
  }
  formattedPrompt += `\n${prompt}\n> `;

  return new Promise((resolve, reject) => {
    // Set timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        rl.close();
        reject(new Error(`Human input timeout after ${timeout}ms`));
      }, timeout);
    }

    // Ask question
    rl.question(formattedPrompt, (answer) => {
      // Clear timeout if set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Close interface
      rl.close();

      // Return answer
      logger.debug("Human input received", { inputLength: answer.length });
      resolve(answer);
    });
  });
};

/**
 * Default human input handler
 * This is used if no custom handler is provided
 */
export async function defaultHumanInputHandler(
  prompt: string,
  options: HumanInputOptions = {}
): Promise<string> {
  return consoleInputCallback(prompt, options);
}

/**
 * Request human input
 * Convenience function that uses the default handler
 */
export async function requestHumanInput(
  prompt: string,
  options: HumanInputOptions = {}
): Promise<string> {
  return defaultHumanInputHandler(prompt, options);
}

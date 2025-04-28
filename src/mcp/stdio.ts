/**
 * Custom implementation of stdio_client that handles stderr through rich console.
 */

import { asyncContextManager } from '../context_dependent.js';
import { MemoryObjectReceiveStream, MemoryObjectSendStream, createMemoryObjectStream } from 'anyio-streams';
import { TextReceiveStream } from 'anyio/streams/text';
import { StdioServerParameters, getDefaultEnvironment } from 'mcp/client/stdio';
import { JSONRPCMessage } from 'mcp/types';
import { getLogger } from '../logging/logger.js';
import * as path from 'path';
import * as child_process from 'child_process';
import * as stream from 'stream';
import * as fs from 'fs';
import * as os from 'os';

const logger = getLogger('mcp/stdio');

/**
 * Client transport for stdio: this will connect to a server by spawning a
 * process and communicating with it over stdin/stdout.
 */
export const stdioClientWithRichStderr = asyncContextManager(
  async (
    server: StdioServerParameters,
    errlog: number | stream.Writable = 'pipe'
  ): Promise<[MemoryObjectReceiveStream<JSONRPCMessage | Error>, MemoryObjectSendStream<JSONRPCMessage>]> => {
    const [readStreamWriter, readStream] = createMemoryObjectStream<JSONRPCMessage | Error>(0);
    const [writeStream, writeStreamReader] = createMemoryObjectStream<JSONRPCMessage>(0);

    const command = getExecutableCommand(server.command);

    // Open process with stderr piped for capture
    const process = await createPlatformCompatibleProcess(
      command,
      server.args || [],
      server.env 
        ? { ...getDefaultEnvironment(), ...server.env }
        : getDefaultEnvironment(),
      errlog,
      server.cwd
    );

    if (process.pid) {
      logger.debug(`Started process '${command}' with PID: ${process.pid}`);
    }

    if (process.exitCode !== null) {
      logger.debug(`return code (early) ${process.exitCode}`);
      throw new Error(`Process terminated immediately with code ${process.exitCode}`);
    }

    const stdoutReader = async () => {
      if (!process.stdout) {
        throw new Error("Opened process is missing stdout");
      }

      try {
        let buffer = "";
        process.stdout.setEncoding(server.encoding || 'utf8');
        process.stdout.on('data', (chunk: string) => {
          const lines = (buffer + chunk).split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            try {
              const message = JSON.parse(line) as JSONRPCMessage;
              readStreamWriter.send(message).catch(err => {
                logger.error(`Error sending message to read stream: ${err}`);
              });
            } catch (exc) {
              readStreamWriter.send(exc as Error).catch(err => {
                logger.error(`Error sending exception to read stream: ${err}`);
              });
            }
          }
        });

        process.stdout.on('end', () => {
          readStreamWriter.close();
        });
      } catch (e) {
        logger.error(`Error in stdout_reader: ${e}`);
        readStreamWriter.close();
      }
    };

    const stderrReader = async () => {
      if (!process.stderr) {
        throw new Error("Opened process is missing stderr");
      }

      try {
        process.stderr.setEncoding(server.encoding || 'utf8');
        process.stderr.on('data', (chunk: string) => {
          if (chunk.trim()) {
            // Let the logging system handle the formatting consistently
            try {
              logger.event("info", "mcpserver.stderr", chunk.trimEnd(), null, {});
            } catch (e) {
              logger.error(`Error in stderr_reader handling output: ${e}`);
            }
          }
        });
      } catch (e) {
        logger.error(`Unexpected error in stderr_reader: ${e}`);
      }
    };

    const stdinWriter = async () => {
      if (!process.stdin) {
        throw new Error("Opened process is missing stdin");
      }

      try {
        for await (const message of writeStreamReader) {
          const json = JSON.stringify(message);
          const data = `${json}\n`;
          
          if (!process.stdin.write(data)) {
            // Handle backpressure
            await new Promise(resolve => process.stdin!.once('drain', resolve));
          }
        }
      } catch (e) {
        logger.error(`Error in stdin_writer: ${e}`);
      } finally {
        process.stdin.end();
      }
    };

    // Start all tasks
    stdoutReader();
    stdinWriter();
    stderrReader();

    try {
      return [readStream, writeStream];
    } finally {
      // Clean up process when scope exits
      process.on('exit', () => {
        logger.debug(`Process exited (PID: ${process.pid || 'unknown'})`);
      });

      process.on('error', (err) => {
        logger.error(`Process error: ${err}`);
      });

      return () => {
        // Cleanup function that runs when the context manager exits
        logger.debug(`Terminating process (PID: ${process.pid || 'unknown'})`);
        try {
          process.kill();
        } catch (e) {
          logger.warning(`Error terminating process (PID: ${process.pid || 'unknown'}): ${e}`);
        }
      };
    }
  }
);

/**
 * Get the correct executable command normalized for the current platform.
 *
 * @param command - Base command (e.g., 'uvx', 'npx')
 * @returns Platform-appropriate command
 */
function getExecutableCommand(command: string): string {
  try {
    if (os.platform() !== 'win32') {
      return command;
    } else {
      // For Windows, we need more sophisticated path resolution
      // First check if command exists in PATH as-is
      const commandPath = child_process.spawnSync('where', [command]).status === 0 
        ? command 
        : null;
        
      if (commandPath) {
        return commandPath;
      }

      // Check for Windows-specific extensions
      for (const ext of ['.cmd', '.bat', '.exe', '.ps1']) {
        const extVersion = `${command}${ext}`;
        try {
          const extPath = child_process.spawnSync('where', [extVersion]).status === 0 
            ? extVersion 
            : null;
            
          if (extPath) {
            return extPath;
          }
        } catch (e) {
          // Continue to next extension
        }
      }

      // For regular commands or if we couldn't find special versions
      return command;
    }
  } catch (e) {
    return command;
  }
}

/**
 * Creates a subprocess in a platform-compatible way.
 * Returns a process handle.
 */
async function createPlatformCompatibleProcess(
  command: string,
  args: string[],
  env: Record<string, string> = {},
  errlog: number | stream.Writable = 'pipe',
  cwd?: string
): Promise<child_process.ChildProcess> {
  let spawnOptions: child_process.SpawnOptions = {
    env: env,
    stdio: ['pipe', 'pipe', errlog],
    cwd: cwd,
    windowsHide: true
  };

  if (os.platform() === 'win32') {
    try {
      // On Windows, add the CREATE_NO_WINDOW flag to prevent console windows
      spawnOptions = {
        ...spawnOptions,
        windowsHide: true,
        detached: false
      };
      
      const process = child_process.spawn(command, args, spawnOptions);
      return process;
    } catch (e) {
      // If that fails, try the default method
    }
  }

  // Default method for creating the process
  return child_process.spawn(command, args, spawnOptions);
}
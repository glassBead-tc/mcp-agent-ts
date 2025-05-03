/**
 * CLI for MCP Agent
 */
import { Command } from "commander";
import { getSettings, updateSettings } from "../config.js";
import { getLogger } from "../logging/logger.js";
import { LogLevel } from "../logging/logger.js";
import { MCPApp } from "../app.js";

const logger = getLogger("cli");

/**
 * Option interfaces for type safety
 */
interface ConfigGetOptions {
  key?: string;
}

interface ConfigSetOptions {
  key: string;
  value: string;
}

interface ServerOptions {
  port: string;
  host: string;
  verbose?: boolean;
}

interface RunOptions {
  name: string;
  instruction?: string;
  servers?: string;
  verbose?: boolean;
}

/**
 * Create the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program.name("mcp-agent").description("MCP Agent CLI").version("0.0.1");

  // Config command
  const configCommand = program
    .command("config")
    .description("Manage configuration");

  // Config get command
  configCommand
    .command("get")
    .description("Get configuration")
    .option("-k, --key <key>", "Configuration key")
    .action((options: ConfigGetOptions) => {
      const config = getSettings();

      if (options.key) {
        // Get specific key
        const keys = options.key.split(".");
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
  configCommand
    .command("set")
    .description("Set configuration")
    .requiredOption("-k, --key <key>", "Configuration key")
    .requiredOption("-v, --value <value>", "Configuration value")
    .action((options: ConfigSetOptions) => {
      const config = getSettings();

      // Set specific key
      const keys = options.key.split(".");
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

  // Server command
  program
    .command("server")
    .description("Run MCP Agent server")
    .option("-p, --port <port>", "Server port", "3000")
    .option("-h, --host <host>", "Server host", "localhost")
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (options: ServerOptions) => {
      // Set log level
      if (options.verbose) {
        updateSettings({
          logger: {
            level: LogLevel.DEBUG,
          },
        });
      }

      logger.info("Starting MCP Agent server");

      try {
        // Create and initialize the app
        const app = new MCPApp({ name: "mcp-agent-server" });
        await app.run();

        // Handle process termination
        process.on("SIGINT", async () => {
          logger.info("Received SIGINT, shutting down");
          await app.stop();
          process.exit(0);
        });

        process.on("SIGTERM", async () => {
          logger.info("Received SIGTERM, shutting down");
          await app.stop();
          process.exit(0);
        });

        logger.info(
          `MCP Agent server running on ${options.host}:${options.port}`
        );
      } catch (error) {
        logger.error("Failed to start MCP Agent server", { error });
        process.exit(1);
      }
    });

  // Run command
  program
    .command("run")
    .description("Run an agent")
    .requiredOption("-n, --name <n>", "Agent name")
    .option("-i, --instruction <instruction>", "Agent instruction")
    .option("-s, --servers <servers>", "Comma-separated list of server names")
    .option("-v, --verbose", "Enable verbose logging")
    .action((options: RunOptions) => {
      // Set log level
      if (options.verbose) {
        updateSettings({
          logger: {
            level: LogLevel.DEBUG,
          },
        });
      }

      // Parse servers
      const servers = options.servers ? options.servers.split(",") : [];

      // Run agent
      console.log(`Running agent ${options.name}`);
      console.log(
        `Instruction: ${options.instruction || "You are a helpful agent."}`
      );
      console.log(`Servers: ${servers.join(", ") || "None"}`);

      // TODO: Implement agent runner
    });

  return program;
}

/**
 * Run the CLI
 */
export function runCLI(): void {
  const program = createProgram();
  program.parse(process.argv);
}

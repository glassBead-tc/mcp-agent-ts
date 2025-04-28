#!/usr/bin/env node
/**
 * CLI entry point for MCP Agent
 */
import { runCLI } from './main.js';

// Only run CLI if this file is being executed directly
if (require.main === module) {
  runCLI();
}
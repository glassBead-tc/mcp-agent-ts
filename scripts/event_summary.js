#!/usr/bin/env node
/**
 * MCP Event Summary
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import { convertLogEvent, ProgressAction } from '../src/event_progress.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load events from JSONL file
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<Event[]>} - List of events
 */
async function loadEvents(filePath) {
  const events = [];
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (line.trim()) {
      const rawEvent = JSON.parse(line);
      // Convert from log format to event format
      const event = {
        type: (rawEvent.level || 'info').toLowerCase(),
        namespace: rawEvent.namespace || '',
        message: rawEvent.message || '',
        timestamp: new Date(rawEvent.timestamp),
        data: rawEvent.data || {}
      };
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Create a table for displaying progress events
 * @param {Event[]} events - List of events
 * @returns {string} - Formatted table
 */
function createEventTable(events) {
  // Convert events to progress events
  const progressEvents = [];
  
  for (const event of events) {
    const progressEvent = convertLogEvent(event);
    if (progressEvent) {
      if (progressEvents.length === 0 || 
          JSON.stringify(progressEvent) !== JSON.stringify(progressEvents[progressEvents.length - 1][0])) {
        // Store tuple of [progress_event, original_event]
        progressEvents.push([progressEvent, event]);
      }
    }
  }
  
  // Create table header
  let table = '┏━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n';
  table += '┃ Action     ┃ Target                       ┃ Details                      ┃\n';
  table += '┡━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩\n';
  
  // Add events
  for (const [progressEvent, origEvent] of progressEvents) {
    // Extract agent name from data or fallback to namespace
    let agent = '';
    try {
      agent = origEvent.data.data?.agent_name || '';
      if (!agent) {
        // Fallback to namespace if agent_name not found
        agent = origEvent.namespace ? origEvent.namespace.split('.').pop() || '' : '';
      }
    } catch (error) {
      // Fallback to namespace if there's any error accessing data
      agent = origEvent.namespace ? origEvent.namespace.split('.').pop() || '' : '';
    }
    
    const action = progressEvent.action.padEnd(10, ' ');
    const target = progressEvent.target.padEnd(30, ' ');
    const details = (progressEvent.details || '').padEnd(30, ' ');
    
    table += `│ ${action} │ ${target} │ ${details} │\n`;
    if (progressEvents.indexOf([progressEvent, origEvent]) < progressEvents.length - 1) {
      table += '├────────────┼──────────────────────────────┼──────────────────────────────┤\n';
    }
  }
  
  table += '└────────────┴──────────────────────────────┴──────────────────────────────┘\n';
  
  return table;
}

/**
 * Create a summary panel with stats
 * @param {Event[]} events - List of events
 * @returns {string} - Formatted summary
 */
function createSummaryPanel(events) {
  // Count various event types
  let chatting = 0;
  let toolCalls = 0;
  const mcps = new Set();
  
  for (const event of events) {
    if (event.type === 'info') {
      if (event.namespace.includes('mcp_connection_manager')) {
        const message = event.message;
        if (message.includes(': ')) {
          const mcpName = message.split(': ')[0];
          mcps.add(mcpName);
        }
      }
    }
    
    const progressEvent = convertLogEvent(event);
    if (progressEvent) {
      if (progressEvent.action === ProgressAction.CHATTING) {
        chatting++;
      } else if (progressEvent.action === ProgressAction.CALLING_TOOL) {
        toolCalls++;
      }
    }
  }
  
  let text = 'Summary:\n\n';
  text += `MCPs: ${Array.from(mcps).sort().join(', ')}\n`;
  text += `Chat Turns: ${chatting}\n`;
  text += `Tool Calls: ${toolCalls}\n`;
  
  return text;
}

/**
 * Main function
 * @param {string} logFile - Path to log file
 */
async function main(logFile) {
  // Load events
  const events = await loadEvents(logFile);
  
  // Create layout
  console.log('\n');
  console.log('╭────────────────────────────── Event Statistics ──────────────────────────────╮');
  console.log('│ ' + createSummaryPanel(events).split('\n').join('\n│ ').padEnd(78, ' ') + ' │');
  console.log('╰──────────────────────────────────────────────────────────────────────────────╯');
  console.log('\n');
  console.log('╭────────────────────────────── Progress Events ───────────────────────────────╮');
  console.log('│ ' + createEventTable(events).split('\n').join('\n│ ').padEnd(78, ' ') + ' │');
  console.log('╰──────────────────────────────────────────────────────────────────────────────╯');
  console.log('\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node event_summary.js <log_file>');
  process.exit(1);
}

main(args[0]).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
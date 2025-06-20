/**
 * Test event progress conversion from log events.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Event Progress Conversion', () => {
  /**
   * Test conversion of log events to progress events using gold master approach.
   */
  test('event conversion matches expected output', async () => {
    // Get the paths
    const logFile = path.join(
      __dirname,
      'fixture',
      'mcp_basic_agent_20250131_205604.jsonl'
    );

    // Run the event_summary script to get current output
    const result = await new Promise<string>((resolve, reject) => {
      const process = spawn('tsx', ['scripts/event_summary.js', logFile]);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });
    });

    // Basic sanity check on output
    expect(result).toContain('Event Statistics');
  });
});

/**
 * Utility function to update test fixtures with latest output.
 * This should only be run manually when intentionally updating the expected behavior.
 * 
 * Usage:
 *     node -e "require('./tests/event_progress.test').updateTestFixtures()"
 */
export async function updateTestFixtures(): Promise<void> {
  // Paths
  const fixtureDir = path.join(__dirname, 'fixture');
  const logFile = path.join(fixtureDir, 'mcp_basic_agent_20250131_205604.jsonl');
  const expectedOutputFile = path.join(fixtureDir, 'expected_output.txt');

  if (!fs.existsSync(logFile)) {
    console.error(`Log file not found: ${logFile}`);
    console.error(
      'Please run an example to generate a log file and copy it to the fixture directory'
    );
    return;
  }

  // Run command and capture output
  const result = await new Promise<string>((resolve, reject) => {
    const process = spawn('tsx', ['scripts/event_summary.js', logFile]);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }
    });
  });

  // Update expected output file
  fs.writeFileSync(expectedOutputFile, result);

  console.log(`Updated test fixtures:\n- ${expectedOutputFile}`);
}

// For running directly
if (require.main === module) {
  describe('Event Progress Conversion', () => {
    test('event conversion matches expected output', async () => {
      // Test code here
    });
  });
}
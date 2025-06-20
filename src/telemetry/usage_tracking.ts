/**
 * Usage tracking for MCP Agent
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getSettings } from '../config.js';
import { getLogger } from '../logging/logger.js';

const logger = getLogger('usage_tracking');

/**
 * Send anonymous usage data for product improvement
 * Only sends data if enabled in settings
 */
export async function sendUsageData(): Promise<void> {
  const config = getSettings();
  if (!config.usage_telemetry?.enabled) {
    logger.info('Usage tracking is disabled');
    return;
  }

  try {
    // Generate a hashed installation id
    const installationId = createHash('sha256')
      .update(uuidv4())
      .digest('hex');

    // Read package version
    const pkgPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '../../package.json'
    );
    const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    const data = {
      installation_id: installationId,
      version,
    };

    await fetch('https://telemetry.example.com/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
  } catch (error) {
    // Silently handle errors - telemetry should never interrupt the app
    logger.debug(`Failed to send usage data: ${error}`);
  }
}

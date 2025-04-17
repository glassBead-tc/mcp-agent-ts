/**
 * Task registry for MCP Agent
 */
import { getLogger } from '../logging/logger';

const logger = getLogger('task_registry');

/**
 * Activity metadata interface
 */
export interface ActivityMetadata {
  activity_name: string;
  schedule_to_close_timeout: number | { seconds: number };
  retry_policy?: {
    maximum_attempts?: number;
    initial_interval?: number;
    maximum_interval?: number;
    backoff_coefficient?: number;
    non_retryable_error_types?: string[];
  };
  [key: string]: any;
}

/**
 * Activity registry for managing activities
 */
export class ActivityRegistry {
  private activities: Map<string, { fn: Function; metadata: ActivityMetadata }> = new Map();
  
  /**
   * Register an activity
   */
  register(name: string, fn: Function, metadata: ActivityMetadata): void {
    logger.debug(`Registering activity ${name}`);
    this.activities.set(name, { fn, metadata });
  }
  
  /**
   * Get an activity by name
   */
  get(name: string): { fn: Function; metadata: ActivityMetadata } | undefined {
    return this.activities.get(name);
  }
  
  /**
   * List all registered activities
   */
  listActivities(): { name: string; metadata: ActivityMetadata }[] {
    return Array.from(this.activities.entries()).map(([name, { metadata }]) => ({
      name,
      metadata,
    }));
  }
  
  /**
   * Execute an activity
   */
  async execute(name: string, args: any[] = []): Promise<any> {
    const activity = this.activities.get(name);
    if (!activity) {
      throw new Error(`Activity ${name} not found`);
    }
    
    logger.debug(`Executing activity ${name}`, { args });
    
    try {
      return await activity.fn(...args);
    } catch (error) {
      logger.error(`Error executing activity ${name}`, { error });
      throw error;
    }
  }
}

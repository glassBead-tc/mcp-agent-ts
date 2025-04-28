// import { activity } from 'temporalio';
// import { genClient } from './gen_client';

/**
 * Decorator factory for MCP activities
 * @param serverName The name of the server to connect to
 * @param mcpCall The MCP call function to execute
 */
/*
export function mcpActivity(serverName: string, mcpCall: Function) {
  return function decorator(func: Function) {
    // @activity.defn
    async function wrapper(...activityArgs: any[]) {
      const params = await func(...activityArgs);
      const client = await genClient(serverName);
      try {
        return await mcpCall(client, params);
      } finally {
        client.close();
      }
    }

    return wrapper;
  };
}
*/
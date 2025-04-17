/**
 * JSON serializer for logging
 */

/**
 * Safely serialize an object to JSON, handling circular references
 */
export function safeSerialize(obj: any): string {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (key, value) => {
    // Handle special cases
    if (value === undefined) {
      return '[undefined]';
    }
    
    if (value === null) {
      return null;
    }
    
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        ...value,
      };
    }
    
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    
    // Handle symbols
    if (typeof value === 'symbol') {
      return value.toString();
    }
    
    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }
    
    return value;
  });
}

/**
 * Safely parse a JSON string
 */
export function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch (error) {
    return { error: 'Failed to parse JSON', original: json };
  }
}

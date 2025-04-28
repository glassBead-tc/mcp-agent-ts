/**
 * Context dependent base class for components that need context access.
 * Provides both global fallback and instance-specific context support.
 */

import { Context, getCurrentContext } from './context.js';

/**
 * Mixin class for components that need context access.
 * Provides both global fallback and instance-specific context support.
 */
export class ContextDependent {
  protected _context?: Context;

  /**
   * Create a new context dependent instance
   * 
   * @param context - Optional context to use
   */
  constructor(context?: Context) {
    this._context = context;
  }

  /**
   * Get context, with graceful fallback to global context if needed.
   * Raises clear error if no context is available.
   */
  get context(): Context {
    // First try instance context
    if (this._context !== undefined) {
      return this._context;
    }

    try {
      // Fall back to global context if available
      return getCurrentContext();
    } catch (e) {
      throw new Error(
        `No context available for ${this.constructor.name}. ` +
        "Either initialize MCPApp first or pass context explicitly."
      );
    }
  }

  /**
   * Temporarily use a different context
   * 
   * @param context - The context to use temporarily
   * @param callback - Function to execute with the temporary context
   * @returns Promise resolving to the callback result
   */
  async withContext<T>(context: Context, callback: () => Promise<T>): Promise<T> {
    const oldContext = this._context;
    this._context = context;
    try {
      return await callback();
    } finally {
      this._context = oldContext;
    }
  }

  /**
   * Synchronously use a different context
   * 
   * @param context - The context to use temporarily
   * @param callback - Function to execute with the temporary context
   * @returns The callback result
   */
  withContextSync<T>(context: Context, callback: () => T): T {
    const oldContext = this._context;
    this._context = context;
    try {
      return callback();
    } finally {
      this._context = oldContext;
    }
  }
}
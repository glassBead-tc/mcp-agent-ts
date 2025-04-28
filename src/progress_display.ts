/**
 * Progress display manager for MCP Agent
 */

import { ProgressEvent } from './event_progress.js';
import { RichProgressDisplay } from './logging/rich_progress.js';
import { ContextDependent } from './context_dependent.js';
import { Context } from './context/index.js';

export class ProgressDisplay extends ContextDependent {
  /**
   * Manages the display of progress events
   */
  
  private display: RichProgressDisplay;
  private enabled: boolean = true;
  
  constructor(context?: Context, ...args: any[]) {
    super({ context, ...args });
    this.display = new RichProgressDisplay();
    this.display.start();
  }
  
  update(event: ProgressEvent): void {
    /**
     * Update the progress display with a new event
     */
    if (this.enabled) {
      this.display.update(event);
    }
  }
  
  enable(): void {
    /**
     * Enable the progress display
     */
    this.enabled = true;
    this.display.resume();
  }
  
  disable(): void {
    /**
     * Disable the progress display
     */
    this.enabled = false;
    this.display.pause();
  }
  
  shutdown(): void {
    /**
     * Shutdown the progress display
     */
    this.display.stop();
  }
}
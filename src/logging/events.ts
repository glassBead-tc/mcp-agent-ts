/**
 * Event system for logging
 */
import { LogLevel } from '../types.js';

/**
 * Base event interface
 */
export interface Event {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, any>;
}

/**
 * Event filter for filtering events by level
 */
export class EventFilter {
  constructor(private minLevel: LogLevel = LogLevel.INFO) {}

  /**
   * Check if an event should be processed based on its level
   */
  public shouldProcess(event: Event): boolean {
    const levelOrder: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARNING]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.CRITICAL]: 4,
    };

    return levelOrder[event.level] >= levelOrder[this.minLevel];
  }

  /**
   * Set the minimum level for events to be processed
   */
  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get the current minimum level
   */
  public getMinLevel(): LogLevel {
    return this.minLevel;
  }
}

/**
 * Event listener interface
 */
export interface EventListener {
  onEvent(event: Event): void;
}

/**
 * Event emitter for broadcasting events to listeners
 */
export class EventEmitter {
  private listeners: EventListener[] = [];
  private filter: EventFilter;

  constructor(filter?: EventFilter) {
    this.filter = filter || new EventFilter();
  }

  /**
   * Add a listener
   */
  public addListener(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  public removeListener(listener: EventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   */
  public emit(event: Event): void {
    if (this.filter.shouldProcess(event)) {
      for (const listener of this.listeners) {
        listener.onEvent(event);
      }
    }
  }

  /**
   * Set the event filter
   */
  public setFilter(filter: EventFilter): void {
    this.filter = filter;
  }
}

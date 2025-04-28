/**
 * Rich-based progress display for MCP Agent.
 */

import { Console } from 'rich';
import { Progress, SpinnerColumn, TextColumn } from 'rich/progress';
import { console as defaultConsole } from '../console.js';
import { ProgressEvent, ProgressAction } from '../event_progress.js';

export class RichProgressDisplay {
  /**
   * Rich-based display for progress events.
   */
  console: Console;
  private _taskmap: Record<string, number> = {};
  private _progress: Progress;
  private _paused: boolean = false;

  constructor(console?: Console) {
    /**
     * Initialize the progress display.
     */
    this.console = console || defaultConsole;
    this._progress = new Progress({
      console: this.console,
      transient: false,
      columns: [
        new SpinnerColumn({ spinnerName: 'simpleDotsScrolling' }),
        new TextColumn({
          textFormat: '[progress.description]{task.description}|'
        }),
        new TextColumn({
          textFormat: '{task.fields[target]:<16}',
          style: 'Bold Blue'
        }),
        new TextColumn({
          textFormat: '{task.fields[details]}',
          style: 'dim white'
        })
      ]
    });
  }

  start(): void {
    /**
     * Start the progress display.
     */
    this._progress.start();
  }

  stop(): void {
    /**
     * Stop the progress display.
     */
    this._progress.stop();
  }

  pause(): void {
    /**
     * Pause the progress display.
     */
    if (!this._paused) {
      this._paused = true;

      for (const task of this._progress.tasks) {
        task.visible = false;
      }
      this._progress.stop();
    }
  }

  resume(): void {
    /**
     * Resume the progress display.
     */
    if (this._paused) {
      for (const task of this._progress.tasks) {
        task.visible = true;
      }
      this._paused = false;
      this._progress.start();
    }
  }

  paused<T>(callback: () => T): T {
    /**
     * Function for temporarily pausing the display.
     */
    this.pause();
    try {
      return callback();
    } finally {
      this.resume();
    }
  }

  private _getActionStyle(action: ProgressAction): string {
    /**
     * Map actions to appropriate styles.
     */
    const styles: Record<ProgressAction, string> = {
      [ProgressAction.STARTING]: 'bold yellow',
      [ProgressAction.LOADED]: 'dim green',
      [ProgressAction.INITIALIZED]: 'dim green',
      [ProgressAction.RUNNING]: 'black on green',
      [ProgressAction.CHATTING]: 'bold blue',
      [ProgressAction.ROUTING]: 'bold blue',
      [ProgressAction.PLANNING]: 'bold blue',
      [ProgressAction.READY]: 'dim green',
      [ProgressAction.CALLING_TOOL]: 'bold magenta',
      [ProgressAction.FINISHED]: 'black on green',
      [ProgressAction.SHUTDOWN]: 'black on red',
      [ProgressAction.AGGREGATOR_INITIALIZED]: 'bold green',
      [ProgressAction.FATAL_ERROR]: 'black on red'
    };

    return styles[action] || 'white';
  }

  update(event: ProgressEvent): void {
    /**
     * Update the progress display with a new event.
     */
    const taskName = event.agentName || 'default';

    // Create new task if needed
    if (!this._taskmap[taskName]) {
      const taskId = this._progress.addTask('', {
        total: undefined,
        target: event.target || taskName, // Use task_name as fallback for target
        details: event.agentName || ''
      });
      this._taskmap[taskName] = taskId;
    } else {
      const taskId = this._taskmap[taskName];
    }

    const taskId = this._taskmap[taskName];

    // Ensure no undefined values in the update
    this._progress.updateTask(taskId, {
      description: `[${this._getActionStyle(event.action)}]${event.action.toString().padEnd(15)}`,
      target: event.target || taskName, // Use task_name as fallback for target
      details: event.details || '',
      taskName: taskName
    });

    if (
      event.action === ProgressAction.INITIALIZED ||
      event.action === ProgressAction.READY ||
      event.action === ProgressAction.LOADED
    ) {
      this._progress.updateTask(taskId, {
        completed: 100,
        total: 100
      });
    } else if (event.action === ProgressAction.FINISHED) {
      const task = this._progress.tasks.find(t => t.id === taskId);
      const elapsedTime = task ? this.formatElapsedTime(task.elapsed) : '00:00:00';

      this._progress.updateTask(taskId, {
        completed: 100,
        total: 100,
        details: ` / Elapsed Time ${elapsedTime}`
      });

      // Hide other tasks
      for (const task of this._progress.tasks) {
        if (task.id !== taskId) {
          task.visible = false;
        }
      }
    } else if (event.action === ProgressAction.FATAL_ERROR) {
      this._progress.updateTask(taskId, {
        completed: 100,
        total: 100,
        details: ` / ${event.details}`
      });

      // Hide other tasks
      for (const task of this._progress.tasks) {
        if (task.id !== taskId) {
          task.visible = false;
        }
      }
    } else {
      this._progress.resetTask(taskId);
    }
  }

  private formatElapsedTime(elapsedMs: number): string {
    // Format milliseconds to HH:MM:SS
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
// Type definitions for the 'rich' module
// This declaration file maps rich functionality to common JavaScript libraries

declare module "rich" {
  export class Console {
    constructor(options?: any);
    // Add any methods the Console class should have
  }
}

declare module "rich/progress" {
  export class Progress {
    constructor(options?: any);
    tasks: any[];
    start(): void;
    stop(): void;
    resetTask(taskId: number): void;
    addTask(description: string, options?: any): number;
    updateTask(taskId: number, options?: any): void;
  }

  export class SpinnerColumn {
    constructor(options?: { spinnerName?: string });
  }

  export class TextColumn {
    constructor(options?: { textFormat?: string; style?: string });
  }
}

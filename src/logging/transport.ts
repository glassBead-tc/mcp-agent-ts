/**
 * Transport system for logging
 */
import fs from "fs";
import { LoggerConfig } from "../config/index.js";
import { Event, EventFilter } from "./events.js";

/**
 * Transport interface for handling log events
 */
export interface Transport {
  send(event: Event): Promise<void>;
  flush(): Promise<void>;
}

/**
 * Console transport for logging to the console
 */
export class ConsoleTransport implements Transport {
  constructor(private filter: EventFilter) {}

  async send(event: Event): Promise<void> {
    if (!this.filter.shouldProcess(event)) {
      return;
    }

    const formattedEvent = {
      level: event.level,
      time: event.timestamp,
      message: event.message,
      ...event.data,
    };

    switch (event.level) {
      case "debug":
        console.debug(formattedEvent);
        break;
      case "info":
        console.info(formattedEvent);
        break;
      case "warning":
        console.warn(formattedEvent);
        break;
      case "error":
      case "critical":
        console.error(formattedEvent);
        break;
    }
  }

  async flush(): Promise<void> {
    // No need to flush for console transport
  }
}

/**
 * File transport for logging to a file
 */
export class FileTransport implements Transport {
  private buffer: Event[] = [];
  private flushPromise: Promise<void> | null = null;
  private writeStream: fs.WriteStream | null = null;

  constructor(
    private filePath: string,
    private filter: EventFilter,
    private batchSize: number = 100,
    private flushIntervalMs: number = 5000
  ) {
    this.writeStream = fs.createWriteStream(filePath, { flags: "a" });

    // Set up periodic flush
    setInterval(() => {
      this.flush();
    }, flushIntervalMs);
  }

  async send(event: Event): Promise<void> {
    if (!this.filter.shouldProcess(event)) {
      return;
    }

    this.buffer.push(event);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.flushPromise) {
      return this.flushPromise || Promise.resolve();
    }

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    this.flushPromise = new Promise<void>((resolve, reject) => {
      if (!this.writeStream) {
        resolve();
        return;
      }

      const data =
        eventsToFlush.map((event) => JSON.stringify(event)).join("\n") + "\n";

      this.writeStream.write(data, (err) => {
        this.flushPromise = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return this.flushPromise;
  }

  async close(): Promise<void> {
    await this.flush();

    if (this.writeStream) {
      return new Promise<void>((resolve) => {
        if (this.writeStream) {
          this.writeStream.end(() => {
            this.writeStream = null;
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  }
}

/**
 * Create a transport based on logger settings
 */
export function createTransport(
  settings: LoggerConfig,
  eventFilter: EventFilter
): Transport {
  if (settings.output === "file" && settings.file_path) {
    return new FileTransport(
      settings.file_path,
      eventFilter,
      settings.batch_size,
      settings.flush_interval * 1000
    );
  }

  // Default to console transport
  return new ConsoleTransport(eventFilter);
}

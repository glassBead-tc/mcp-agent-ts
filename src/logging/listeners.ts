/**
 * Event listeners for logging
 */
import { Event, EventListener } from './events';
import { Transport } from './transport';

/**
 * Transport listener that sends events to a transport
 */
export class TransportListener implements EventListener {
  private buffer: Event[] = [];
  private isProcessing = false;
  
  constructor(
    private transport: Transport,
    private batchSize: number = 100
  ) {}

  /**
   * Handle an event by buffering it and potentially flushing
   */
  onEvent(event: Event): void {
    this.buffer.push(event);
    
    if (this.buffer.length >= this.batchSize && !this.isProcessing) {
      this.processBuffer();
    }
  }

  /**
   * Process the buffer of events
   */
  private async processBuffer(): Promise<void> {
    if (this.isProcessing || this.buffer.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    const eventsToProcess = [...this.buffer];
    this.buffer = [];
    
    try {
      for (const event of eventsToProcess) {
        await this.transport.send(event);
      }
      
      await this.transport.flush();
    } catch (error) {
      console.error('Error processing log events:', error);
    } finally {
      this.isProcessing = false;
      
      // If more events accumulated during processing, process them too
      if (this.buffer.length > 0) {
        this.processBuffer();
      }
    }
  }

  /**
   * Flush any pending events
   */
  async flush(): Promise<void> {
    await this.processBuffer();
  }
}

/**
 * Console listener that logs events to the console
 */
export class ConsoleListener implements EventListener {
  onEvent(event: Event): void {
    const { level, message, data } = event;
    
    switch (level) {
      case 'debug':
        console.debug(message, data);
        break;
      case 'info':
        console.info(message, data);
        break;
      case 'warning':
        console.warn(message, data);
        break;
      case 'error':
      case 'critical':
        console.error(message, data);
        break;
    }
  }
}

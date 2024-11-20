import { AOSProcessManager } from './process-manager';

interface ScheduleOptions {
  interval?: number;
  tick?: string;
  maxRetries?: number;
  onError?: string;
}

export class Schedule {
  private processName: string;
  private options: Required<ScheduleOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private retryCount: number = 0;

  constructor(processName: string, options: ScheduleOptions = {}) {
    this.processName = processName;
    this.options = {
      interval: options.interval || 1000,
      tick: options.tick || 'tick',
      maxRetries: options.maxRetries || 3,
      onError: options.onError || 'handleError'
    };
  }

  async start(): Promise<void> {
    if (this.timer) {
      throw new Error('Scheduler already running');
    }

    this.timer = setInterval(async () => {
      try {
        await AOSProcessManager.evaluateProcess(
          this.processName,
          this.options.tick,
          process.cwd(),
          { await: true, timeout: this.options.interval }
        );
        this.retryCount = 0;
      } catch (error) {
        console.error(`Error in scheduler for ${this.processName}:`, error);
        this.retryCount++;

        if (this.retryCount >= this.options.maxRetries) {
          console.error(`Max retries (${this.options.maxRetries}) reached, stopping scheduler`);
          await this.stop();
          
          try {
            await AOSProcessManager.evaluateProcess(
              this.processName,
              this.options.onError,
              process.cwd()
            );
          } catch (errorHandlerError) {
            console.error('Error handler failed:', errorHandlerError);
          }
        }
      }
    }, this.options.interval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.retryCount = 0;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}
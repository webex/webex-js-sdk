import LoggerProxy from '../../logger-proxy';

/**
 * AutoWrapup class implements a timer for automatic wrap-up functionality.
 * It handles timing the wrap-up period and executing a callback when the timer completes.
 */
export default class AutoWrapup {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private readonly interval: number;
  public allowCancelAutoWrapup = false;

  /**
   * Creates a new AutoWrapup timer
   * @param interval - Time in milliseconds before auto wrap-up executes
   *  @param allowCancelAutoWrapup - Whether to allow canceling the auto wrap-up
   */
  constructor(interval: number, allowCancelAutoWrapup = false) {
    this.interval = interval;
    this.allowCancelAutoWrapup = allowCancelAutoWrapup;
  }

  /**
   * Starts the auto wrap-up timer
   * @param onComplete - Callback function to execute when timer completes
   */
  public start(onComplete: () => void): void {
    LoggerProxy.info('AutoWrapup: clear called', {
      module: 'AutoWrapup',
      method: 'clear',
    });

    if (this.timer) {
      this.clear();
    }

    this.startTime = Date.now();

    this.timer = setTimeout(() => {
      onComplete();
      this.timer = null;
    }, this.interval);
  }

  /**
   * Clears the auto wrap-up timer if it's running
   */
  public clear(): void {
    LoggerProxy.info('AutoWrapup: clear called', {
      module: 'AutoWrapup',
      method: 'clear',
    });

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.startTime = 0;
    }
  }

  /**
   * Gets the remaining time in milliseconds
   * @returns Time left in milliseconds
   */
  public getTimeLeft(): number {
    const elapsed = Date.now() - this.startTime;

    return Math.max(0, this.interval - elapsed);
  }

  /**
   * Checks if the timer is currently running
   * @returns True if the timer is running, false otherwise
   */
  public isRunning(): boolean {
    return this.timer !== null;
  }

  /**
   * Gets the remaining time in seconds (rounded)
   * @returns Time left in seconds
   */
  public getTimeLeftSeconds(): number {
    return Math.ceil(this.getTimeLeft() / 1000);
  }
}

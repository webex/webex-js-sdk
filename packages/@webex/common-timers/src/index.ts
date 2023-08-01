/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Wrapper around setTimout which (in node) unrefs the returned timer to avoid
 * wedging the process open unexpectedly.
 * @param {Mixed} args
 * @protected
 * @returns {NodeJS.Timeout|Number}
 */
export function safeSetTimeout(...args: Parameters<typeof setTimeout>): number | NodeJS.Timeout {
  const timer = setTimeout(...args);

  if (timer.unref) {
    timer.unref();
  }

  return timer;
}

/**
 * Wrapper around setInterval which (in node) unrefs the returned timer to avoid
 * wedging the process open unexpectedly.
 * @param {Mixed} args
 * @protected
 * @returns {NodeJS.Timeout|Number}
 */
export function safeSetInterval(...args: Parameters<typeof setInterval>): number | NodeJS.Timeout {
  const interval = setInterval(...args);

  if (interval.unref) {
    interval.unref();
  }

  return interval;
}

/**
 * Create a restartable timer
 */
export class Timer {
  private state: 'init' | 'running' | 'done';
  private readonly timeout: number;
  private readonly callback: () => void;
  private currentTimer: number | NodeJS.Timeout;

  /**
   * Construct timer
   * @param {Function} callback Function called when the timer expired
   * @param {number} timeout duration of the timeout in milliseconds
   */
  constructor(callback: () => void, timeout: number) {
    this.state = 'init';
    this.timeout = timeout;
    this.callback = () => {
      this.state = 'done';
      callback();
    };
  }

  /**
   * Start timer
   * @returns {void}
   */
  start() {
    if (this.state !== 'init') {
      throw new Error(`Can't start the timer when it's in ${this.state} state`);
    }

    this.startTimer();
    this.state = 'running';
  }

  /**
   * Clear the current timer and start a new one
   * @returns {void}
   */
  reset() {
    if (this.state !== 'running') {
      throw new Error(`Can't reset the timer when it's in ${this.state} state`);
    }
    this.clearTimer();
    this.startTimer();
  }

  /**
   * Clear the timer
   * @returns {void}
   */
  cancel() {
    if (this.state !== 'running') {
      throw new Error(`Can't cancel the timer when it's in ${this.state} state`);
    }
    this.clearTimer();
    this.state = 'done';
  }

  /**
   * Create the actual timer
   * @private
   * @returns {undefined}
   */
  private startTimer() {
    this.currentTimer = safeSetTimeout(this.callback, this.timeout);
  }

  /**
   * Clear the actual timer
   * @private
   * @returns {undefined}
   */
  private clearTimer() {
    clearTimeout(this.currentTimer);
  }
}

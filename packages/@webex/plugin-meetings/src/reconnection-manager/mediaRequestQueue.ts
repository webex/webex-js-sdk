import LoggerProxy from '../common/logs/logger-proxy';

type MediaRequestTask = {
  name: string;
  run: () => void;
};

/**
 * Defers media request tasks while the media connection is not ready (e.g. during reconnection)
 * and runs them in the original order once the connection is ready again.
 */
export default class MediaRequestQueue {
  private tasks: MediaRequestTask[] = [];

  private queueing = false;

  /**
   * Clears any previously queued tasks and starts queueing new ones.
   * @returns {void}
   */
  public start(): void {
    this.tasks = [];
    this.queueing = true;
  }

  /**
   * Runs the task immediately if the connection is ready, otherwise queues it.
   * @param {string} name task name used for logging
   * @param {Function} run task to execute
   * @returns {void}
   */
  public runOrEnqueue(name: string, run: () => void): void {
    if (!this.queueing) {
      run();

      return;
    }

    LoggerProxy.logger.info(
      `MediaRequestQueue#runOrEnqueue --> connection not-ready, enqueuing ${name} task`
    );
    this.tasks.push({name, run});
  }

  /**
   * Stops queueing and runs all queued tasks in the order they were added.
   * @returns {void}
   */
  public flush(): void {
    const {tasks} = this;

    this.clear();

    LoggerProxy.logger.info(`MediaRequestQueue#flush --> flushing queue, tasks: ${tasks.length}`);

    tasks.forEach(({name, run}) => {
      LoggerProxy.logger.info(`MediaRequestQueue#flush --> running ${name} task`);

      try {
        run();
      } catch (error) {
        LoggerProxy.logger.error(`MediaRequestQueue#flush --> ${name} task failed`, error);
      }
    });
  }

  /**
   * Stops queueing and discards all queued tasks.
   * @returns {void}
   */
  public clear(): void {
    this.tasks = [];
    this.queueing = false;
  }
}

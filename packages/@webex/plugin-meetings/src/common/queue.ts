/**
 * Simple queue
 */
export default class SimpleQueue {
  queue: any[];
  /**
   * @constructs SimpleQueue
   */
  constructor() {
    this.queue = [];
  }

  /**
   * Removes all of the elements from queue.
   * @returns {undefined}
   */
  clear() {
    this.queue = [];
  }

  /**
   * Inserts the specified element into the queue.
   * @param {object} item
   * @returns {undefined}
   */
  enqueue(item: object) {
    this.queue.push(item);
  }

  /**
   * Returns and removes the head of the queue.
   * Returns null if the queue is empty.
   * @returns {(object|null)} Queue item or null.
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    return this.queue.shift();
  }

  /**
   * Returns the number of items in queue.
   * @returns {number}
   */
  size() {
    return this.queue.length;
  }
}

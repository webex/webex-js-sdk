/**
 * Simple queue in which the elements are always sorted
 */
export default class SortedQueue<ItemType> {
  queue: ItemType[];
  // returns -1 if left < right, 0 if left === right, +1 if left > right
  compareFunc: (left: ItemType, right: ItemType) => number;

  /**
   * @constructs SortedQueue
   * @param {Function} compareFunc comparison function used for sorting the elements of the queue
   */
  constructor(compareFunc: (left: ItemType, right: ItemType) => number) {
    this.queue = [];
    this.compareFunc = compareFunc;
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
  enqueue(item: ItemType) {
    // Find the index of the first item in the queue that's greater or equal to the new item.
    // That's where we want to insert the new item.
    const idx = this.queue.findIndex((existingItem) => {
      return this.compareFunc(existingItem, item) >= 0;
    });
    if (idx >= 0) {
      this.queue.splice(idx, 0, item);
    } else {
      this.queue.push(item);
    }
  }

  /**
   * Returns and removes the head of the queue.
   * Returns null if the queue is empty.
   * @returns {(object|null)} Queue item or null.
   */
  dequeue(): ItemType {
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

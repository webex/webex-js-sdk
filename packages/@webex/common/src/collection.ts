// eslint-disable-next-line import/no-unresolved
import {WebexEventEmitter} from './events';

/**
 * A modern, typed collection class that serves as a replacement
 * for ampersand-collection. It provides a structured way to manage
 * collections of items and emit change events.
 *
 * @export
 * @class WebexCollection
 * @extends {WebexEventEmitter}
 * @template T
 */
export class WebexCollection<T> extends WebexEventEmitter {
  private models: T[] = [];

  /**
   * Adds an item to the collection.
   *
   * @param {T} model
   * @returns {void}
   * @memberof WebexCollection
   */
  add(model: T): void {
    this.models.push(model);
    this.emit('add', model);
    this.emit('change');
  }

  /**
   * Removes an item from the collection.
   *
   * @param {T} model
   * @returns {void}
   * @memberof WebexCollection
   */
  remove(model: T): void {
    const index = this.models.indexOf(model);

    if (index > -1) {
      this.models.splice(index, 1);
      this.emit('remove', model);
      this.emit('change');
    }
  }

  /**
   * Returns the number of items in the collection.
   *
   * @readonly
   * @memberof WebexCollection
   */
  get length() {
    return this.models.length;
  }

  /**
   * Returns the items in the collection.
   *
   * @returns {T[]}
   * @memberof WebexCollection
   */
  getModels(): T[] {
    return [...this.models];
  }
}

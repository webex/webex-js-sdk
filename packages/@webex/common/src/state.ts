import {WebexEventEmitter} from './events';

/**
 * @description Represents the payload for a 'change' event.
 * @export
 * @interface IChangePayload
 * @template T - The type of the state object.
 * @template K - A key within the state object.
 */
export interface IChangePayload<T, K extends keyof T> {
  key: K;
  value: T[K];
  old: T[K];
}

/**
 * @class WebexState
 * @extends {WebexEventEmitter}
 * @template T - A generic type for the state, which must be a record of string keys to any value.
 * @description A modern, typed state management class that serves as a replacement
 * for ampersand-state. It provides a structured way to manage state
 * and emit change events.
 */
export class WebexState<T extends Record<string, any>> extends WebexEventEmitter {
  private attributes: T;

  /**
   * @constructs WebexState
   * @param {T} attributes - The initial attributes to set on the state object.
   */
  constructor(attributes: T) {
    super();
    this.attributes = attributes;
  }

  /**
   * Gets a value from the state.
   *
   * @template K
   * @param {K} key - The key of the attribute to retrieve.
   * @returns {T[K]} The value of the attribute.
   */
  public get<K extends keyof T>(key: K): T[K] {
    return this.attributes[key];
  }

  /**
   * Sets a value in the state and emits a change event if the value has changed.
   * It emits two events:
   * 1. `change:{key}` with the new and old values.
   * 2. `change` with a payload containing the key, new value, and old value.
   *
   * @template K
   * @param {K} key - The key of the attribute to set.
   * @param {T[K]} value - The new value for the attribute.
   */
  public set<K extends keyof T>(key: K, value: T[K]): void {
    const old = this.attributes[key];

    if (old !== value) {
      this.attributes[key] = value;
      this.emit(`change:${String(key)}`, value, old);
      this.emit('change', {key, value, old} as IChangePayload<T, K>);
    }
  }

  /**
   * @function getState
   * @returns {T} A shallow copy of the full state object.
   * @description Returns the full state object.
   */
  public getState(): T {
    return {...this.attributes};
  }
}

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexEventEmitter} from './events';

/**
 * Interface for change payload that gets emitted when state changes
 */
export interface IChangePayload<T, K extends keyof T> {
  key: K;
  value: T[K];
  old: T[K];
}

/**
 * @class WebexState
 * @extends {WebexEventEmitter}
 * @description Base class for state management in Webex plugins. Provides reactive state
 * management with automatic change event emission when properties are modified.
 * This replaces the old AmpersandState functionality with a modern TypeScript implementation.
 */
export class WebexState<T = any> extends WebexEventEmitter {
  /**
   * Internal state storage
   */
  private _state: Partial<T> = {};

  /**
   * @constructs WebexState
   * @param {Partial<T>} initialState - Initial state values
   */
  constructor(initialState: Partial<T> = {}) {
    super(); // Initialize WebexEventEmitter which initializes EventEmitter

    // Set initial state values
    Object.assign(this._state, initialState);

    // Set up property accessors for reactive state management
    this._setupReactiveProperties();
  }

  /**
   * Set up reactive properties that emit change events when modified
   * @private
   * @returns {void}
   */
  private _setupReactiveProperties(): void {
    // Create getters and setters for all initial state keys
    Object.keys(this._state).forEach((key) => {
      this._createReactiveProperty(key as keyof T);
    });
  }

  /**
   * Create a reactive property that emits change events
   * @private
   * @param {keyof T} key - The property key
   * @returns {void}
   */
  private _createReactiveProperty(key: keyof T): void {
    Object.defineProperty(this, key, {
      get(): T[keyof T] {
        return this._state[key];
      },
      set(newValue: T[keyof T]): void {
        const oldValue = this._state[key];
        if (oldValue !== newValue) {
          this._state[key] = newValue;
          this.emit('change', {
            key,
            value: newValue,
            old: oldValue,
          } as IChangePayload<T, keyof T>);
          this.emit(`change:${String(key)}`, newValue, oldValue);
        }
      },
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Set a property value and emit change events
   * @param {keyof T} key - The property key
   * @param {T[keyof T]} value - The new value
   * @returns {void}
   */
  public set<K extends keyof T>(key: K, value: T[K]): void {
    // Create reactive property if it doesn't exist
    if (!(key in this)) {
      this._createReactiveProperty(key);
    }

    // Set the value (this will trigger the setter and emit events)
    (this as any)[key] = value;
  }

  /**
   * Get a property value
   * @param {keyof T} key - The property key
   * @returns {T[keyof T]} The property value
   */
  public get<K extends keyof T>(key: K): T[K] {
    return (this as any)[key];
  }

  /**
   * Check if a property has been set
   * @param {keyof T} key - The property key
   * @returns {boolean} True if the property exists
   */
  public has(key: keyof T): boolean {
    return key in this._state;
  }

  /**
   * Remove a property and emit change events
   * @param {keyof T} key - The property key
   * @returns {void}
   */
  public unset(key: keyof T): void {
    if (this.has(key)) {
      const oldValue = this._state[key];
      delete this._state[key];
      delete (this as any)[key];

      this.emit('change', {
        key,
        value: undefined,
        old: oldValue,
      } as IChangePayload<T, keyof T>);
      this.emit(`change:${String(key)}`, undefined, oldValue);
    }
  }

  /**
   * Get all state as a plain object
   * @returns {Partial<T>} A copy of the current state
   */
  public toJSON(): Partial<T> {
    return {...this._state};
  }

  /**
   * Clear all state and emit change events
   * @returns {void}
   */
  public clear(): void {
    Object.keys(this._state).forEach((key) => {
      this.unset(key as keyof T);
    });
  }

  /**
   * Set multiple properties at once
   * @param {Partial<T>} values - Object containing key-value pairs to set
   * @returns {void}
   */
  public setAll(values: Partial<T>): void {
    Object.entries(values).forEach(([key, value]) => {
      this.set(key as keyof T, value as T[keyof T]);
    });
  }
}

export default WebexState;

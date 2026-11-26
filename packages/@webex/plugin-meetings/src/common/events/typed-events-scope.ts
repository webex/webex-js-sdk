import EventsScope from './events-scope';

/**
 * A map of event name to the payload passed to its listeners.
 */
export type EventPayloadMap<TEvents> = {[K in keyof TEvents]: unknown};

/**
 * An EventsScope whose event names and payloads are checked at compile time against TEvents.
 * Emitting logs the same way as EventsScope. Each event carries a single payload argument, matching
 * EventsScope.emit().
 *
 * @usage
 * ```ts
 * interface MyEvents {
 *   'my:event': {value: number};
 * }
 *
 * class MyEmitter extends TypedEventsScope<MyEvents> {}
 * ```
 */
export default class TypedEventsScope<
  TEvents extends EventPayloadMap<TEvents>
> extends EventsScope {
  /**
   * Emits and logs an event
   * @param {Object} scope - Logging scope ({file, function}).
   * @param {string} event
   * @param {*} payload
   * @returns {boolean}
   */
  emit<K extends keyof TEvents & string>(scope: any, event: K, payload: TEvents[K]): boolean {
    return super.emit(scope, event, payload);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  on<K extends keyof TEvents & string>(event: K, listener: (payload: TEvents[K]) => void): this {
    return super.on(event, listener);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  once<K extends keyof TEvents & string>(event: K, listener: (payload: TEvents[K]) => void): this {
    return super.once(event, listener);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  off<K extends keyof TEvents & string>(event: K, listener: (payload: TEvents[K]) => void): this {
    return super.off(event, listener);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  addListener<K extends keyof TEvents & string>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): this {
    return super.addListener(event, listener);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  removeListener<K extends keyof TEvents & string>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): this {
    return super.removeListener(event, listener);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  prependListener<K extends keyof TEvents & string>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): this {
    return super.prependListener(event, listener);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {this}
   */
  prependOnceListener<K extends keyof TEvents & string>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): this {
    return super.prependOnceListener(event, listener);
  }
}

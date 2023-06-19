/* eslint-disable valid-jsdoc */
import EventEmitter from 'events';
import TypedEmitter, {EventMap} from 'typed-emitter'; // eslint-disable-line import/no-extraneous-dependencies
import Logger from '../../Logger';
import {LOG_PREFIX} from '../../Logger/types';

/**
 *
 */
export class Eventing<T extends EventMap> extends (EventEmitter as {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  new <T extends EventMap>(): TypedEmitter<T>;
})<T> {
  /**
   * @param event - TODO.
   * @param args - TODO.
   */
  emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>): boolean {
    const timestamp = new Date().toUTCString();

    Logger.log(
      `${timestamp} ${
        LOG_PREFIX.EVENT
      }: ${event.toString()} - event emitted with parameters -> ${args} = `,
      {
        file: 'Events/impl/index.ts',
        method: 'emit',
      }
    );

    return super.emit(event, ...args);
  }

  /**
   * .
   *
   * @param event - Event to listen to.
   * @param listener - Callback for event.
   */
  on<E extends keyof T>(event: E, listener: T[E]): this {
    return super.on(event, listener);
  }

  /**
   * .
   *
   * @param event - Event to remove listener on.
   * @param listener - Callback for event.
   */
  off<E extends keyof T>(event: E, listener: T[E]): this {
    return super.off(event, listener);
  }
}

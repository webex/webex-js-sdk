/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import EventEmitter from 'events';
import TypedEmitter, {EventMap} from 'typed-emitter'; // eslint-disable-line import/no-extraneous-dependencies
import Logger from '../../Logger';
import {LOG_PREFIX} from '../../Logger/types';

/**
 *
 */
export class Eventing<T extends EventMap> extends (EventEmitter as {
  new <T extends EventMap>(): TypedEmitter<T>;
})<T> {
  /**
   * @event
   *
   * @param event - Event that is going ot be emitted.
   * @param args - Parameters that are emitted with the event.
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
   * @event
   *
   * @param event - Event to listen to.
   * @param listener - Callback for event.
   */
  on<E extends keyof T>(event: E, listener: T[E]): this {
    return super.on(event, listener);
  }

  /**
   * .
   * @event
   *
   * @param event - Event to remove listener on.
   * @param listener - Callback for event.
   */
  off<E extends keyof T>(event: E, listener: T[E]): this {
    return super.off(event, listener);
  }
}

import {nullPrototypeRecord} from './json';

/**
 * Counter names. The SDK performs no network I/O of its own and never phones home;
 * consumers read these and wire them into their own telemetry.
 */
export const CounterName = {
  PUSH_SENT: 'pushSent',
  PUSH_RECEIVED: 'pushReceived',
  REQUEST_ISSUED: 'requestIssued',
  REQUEST_SERVED: 'requestServed',
  REQUEST_FAILED: 'requestFailed',
  DROPPED: 'dropped',
  RATE_LIMITED: 'rateLimited',
  /** A push the content relay refused before it ever reached the worker. */
  RELAY_DROPPED: 'relayDropped',
  /** A `runtime.sendMessage` from the relay to the worker that never arrived. */
  RELAY_SEND_FAILED: 'relaySendFailed',
  /** A `chrome.storage.session` write the platform refused. */
  STORAGE_WRITE_FAILED: 'storageWriteFailed',
} as const;

export type CounterName = (typeof CounterName)[keyof typeof CounterName];

/**
 * Flat counter store.
 *
 * Keys are composed from counter names and error or drop codes, which are
 * allow-listed enums rather than free-form strings; the backing record still has a
 * null prototype so a future caller cannot poison it.
 */
export class Counters {
  private values = nullPrototypeRecord<number>();

  /**
   * @param name - Counter name.
   * @param detail - Optional suffix, such as an error code or drop reason.
   * @param by - Increment amount.
   */
  public increment(name: CounterName, detail?: string, by = 1): void {
    const key = detail === undefined ? name : `${name}.${detail}`;

    this.values[key] = (this.values[key] ?? 0) + by;
  }

  /**
   * @returns A copy of the current counts, safe to hand to a consumer.
   */
  public snapshot(): Record<string, number> {
    return Object.assign(nullPrototypeRecord<number>(), this.values);
  }

  public reset(): void {
    this.values = nullPrototypeRecord<number>();
  }
}

/**
 * Observer pattern: LogRecordSubscriptions sends accepted SDK records to listeners.
 * Nested logs wait until the current record reaches all eligible listeners.
 * Each synchronous notification pass clears its temporary FIFO.
 */
import {snapshotRecord} from './log-record';
import type {BufferEntryMetadata, LogRecord} from './log-record';

export type LogRecordListener = (record: LogRecord) => void;

/** Read retained history and receive future records without changing support-upload cursors. */
export interface LogRecordSource {
  /** Return owned records in logger-wide sequence order. */
  getRecords(): readonly LogRecord[];
  /** Receive future accepted records. The returned function removes this subscription. */
  subscribe(listener: LogRecordListener): () => void;
}

interface PendingNotification {
  bufferEntry: object;
  metadata: BufferEntryMetadata;
  observedTimestamp: number;
  /** Registrations present when this entry was accepted. */
  listeners: LogRecordListener[];
}

/** Notify listeners in acceptance order without letting one listener break SDK logging. */
export class LogRecordSubscriptions {
  /** Each registration has its own callback, even when the caller uses the same listener. */
  private readonly listeners = new Set<LogRecordListener>();

  /** Entries in this notification pass, including logs written by listeners. */
  private readonly pendingNotifications: PendingNotification[] = [];

  /** True during delivery. Nested log calls append to the FIFO instead of starting another pass. */
  private isNotifying = false;

  /**
   * Register for future records; duplicate callbacks remain independent.
   * @param {LogRecordListener} listener - Future-record observer.
   * @returns {function} Idempotent unsubscribe callback.
   * @throws {TypeError} If listener is not a function.
   */
  subscribe(listener: LogRecordListener): () => void {
    if (typeof listener !== 'function') {
      throw new TypeError('A log listener is required');
    }
    const subscription: LogRecordListener = (record) => listener(record);

    this.listeners.add(subscription);

    return () => {
      this.listeners.delete(subscription);
    };
  }

  /**
   * Queue one accepted entry for its registered listeners, then deliver in order.
   * @param {Object} bufferEntry - Accepted retained entry.
   * @param {BufferEntryMetadata} metadata - Its filtered append metadata.
   * @returns {undefined}
   */
  notify(bufferEntry: object, metadata: BufferEntryMetadata): void {
    if (!this.listeners.size) {
      return;
    }
    this.pendingNotifications.push({
      bufferEntry,
      metadata,
      observedTimestamp: Date.now(),
      listeners: [...this.listeners],
    });
    if (this.isNotifying) {
      return;
    }
    this.isNotifying = true;
    try {
      for (const notification of this.pendingNotifications) {
        try {
          this.notifyListeners(notification);
        } catch {
          // Skip an unreadable entry and continue with later entries.
        }
      }
    } finally {
      this.pendingNotifications.length = 0;
      this.isNotifying = false;
    }
  }

  /**
   * Give each still-registered listener an independently owned record.
   * @param {PendingNotification} notification - Accepted entry and listener snapshot.
   * @returns {undefined}
   */
  private notifyListeners(notification: PendingNotification): void {
    const {bufferEntry, metadata, observedTimestamp, listeners} = notification;
    const body = String(bufferEntry);

    for (const listener of listeners) {
      if (this.listeners.has(listener)) {
        try {
          listener(snapshotRecord(body, metadata, observedTimestamp));
        } catch {
          // Keep a failed consumer separate from SDK logging and the other consumers.
        }
      }
    }
  }
}

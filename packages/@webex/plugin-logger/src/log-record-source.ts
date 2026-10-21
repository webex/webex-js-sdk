/**
 * Defines the record-source contract and owns synchronous subscriber notification.
 * Pending notifications exist only to preserve order under reentrant logging.
 */
import {snapshotRecord} from './log-record';
import type {BufferEntryMetadata, LogRecord} from './log-record';

export type LogRecordListener = (record: LogRecord) => void;

export interface LogRecordSource {
  getRecords(): readonly LogRecord[];
  subscribe(listener: LogRecordListener): () => void;
}

interface PendingNotification {
  bufferEntry: object;
  metadata: BufferEntryMetadata;
  observedTimestamp: number;
  listeners: LogRecordListener[];
}

/** Owns listener membership and temporary notifications, not retained records. */
export class LogRecordSubscriptions {
  private readonly listeners = new Set<LogRecordListener>();

  private readonly pendingNotifications: PendingNotification[] = [];

  private isNotifying = false;

  /**
   * Register for future records; duplicate callbacks remain independent.
   * @param {LogRecordListener} listener - Future-record observer.
   * @returns {function} Idempotent unsubscribe callback.
   */
  subscribe(listener: LogRecordListener): () => void {
    if (typeof listener !== 'function') throw new TypeError('A log listener is required');
    const subscription: LogRecordListener = (record) => listener(record);

    this.listeners.add(subscription);

    return () => {
      this.listeners.delete(subscription);
    };
  }

  /**
   * Notify listeners present at acceptance without interleaving reentrant records.
   * @param {Object} bufferEntry - Accepted retained entry.
   * @param {BufferEntryMetadata} metadata - Its filtered append metadata.
   * @returns {undefined}
   */
  notify(bufferEntry: object, metadata: BufferEntryMetadata): void {
    if (!this.listeners.size) return;
    this.pendingNotifications.push({
      bufferEntry,
      metadata,
      observedTimestamp: Date.now(),
      listeners: [...this.listeners],
    });
    if (this.isNotifying) return;
    this.isNotifying = true;
    try {
      for (const notification of this.pendingNotifications) {
        try {
          this.notifyListeners(notification);
        } catch {
          // A malformed retained body cannot interrupt later notifications.
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
          // One consumer cannot change source logging or another consumer's record.
        }
      }
    }
  }
}

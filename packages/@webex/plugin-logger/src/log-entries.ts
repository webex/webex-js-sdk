import {snapshotRecord} from './log-record';
import type {EntryMetadata, LogRecord} from './log-record';

export type LogEntryListener = (record: LogRecord) => void;
export interface LogEntries {
  getEntries(): readonly LogRecord[];
  onEntry(listener: LogEntryListener): () => void;
}
interface PendingNotification {
  entry: object;
  metadata: EntryMetadata;
  observedTimestamp: number;
  listeners: LogEntryListener[];
}

export function snapshotEntries(
  buffers: readonly {buffer: object[]}[],
  entries: WeakMap<object, EntryMetadata>
): readonly LogRecord[] {
  const retained = buffers
    .flatMap(({buffer}) => [...buffer])
    .map((entry) => {
      const metadata = entries.get(entry);

      if (!metadata) throw new Error('Retained log is missing append metadata');

      return {entry, metadata};
    })
    .sort((first, second) => first.metadata.seq - second.metadata.seq);
  const observedTimestamp = Date.now();

  return Object.freeze(
    retained.map(({entry, metadata}) => snapshotRecord(entry, metadata, observedTimestamp))
  );
}

export function createLogNotifications() {
  const listeners = new Set<LogEntryListener>();
  const pending: PendingNotification[] = [];
  let dispatching = false;

  function deliver(notification: PendingNotification): void {
    const {entry, metadata, observedTimestamp} = notification;
    const body = String(entry);

    for (const listener of notification.listeners) {
      if (listeners.has(listener)) {
        try {
          listener(snapshotRecord(body, metadata, observedTimestamp));
        } catch {
          // One consumer cannot change source logging or another consumer's record.
        }
      }
    }
  }

  return {
    onEntry(listener: LogEntryListener): () => void {
      if (typeof listener !== 'function') throw new TypeError('A log listener is required');
      const subscription: LogEntryListener = (record) => listener(record);

      listeners.add(subscription);

      return () => {
        listeners.delete(subscription);
      };
    },
    notify(entry: object, metadata: EntryMetadata): void {
      if (!listeners.size) return;
      pending.push({entry, metadata, observedTimestamp: Date.now(), listeners: [...listeners]});
      if (dispatching) return;
      dispatching = true;
      try {
        for (const notification of pending) {
          try {
            deliver(notification);
          } catch {
            // A malformed retained body cannot interrupt later notifications.
          }
        }
      } finally {
        pending.length = 0;
        dispatching = false;
      }
    },
  };
}

import {snapshotRecord} from './log-record';
import type {EntryMetadata, LogRecord} from './log-record';

export interface LogReceipt {
  readonly records: readonly LogRecord[];
  commit(completedRecords: number): void;
  release(): void;
}
export interface LogReader {
  read(options: {maxEstimatedBytes: number; maxRecords: number}): LogReceipt | undefined;
  hasPending(): boolean;
  readonly dropped: number;
  close(): void;
}
interface BufferState {
  buffer: object[];
  baseIndex: number;
}
interface SelectedRecord {
  buffer: BufferState;
  position: number;
  record: LogRecord;
}
interface Selection {
  rows: SelectedRecord[];
  completed: number;
}
export interface ReaderState {
  positions: Map<BufferState, number>;
  dropped: number;
  open: boolean;
}

export function createLogReader(
  name: string,
  getBuffers: () => BufferState[],
  entries: WeakMap<object, EntryMetadata>,
  readers: Map<string, ReaderState>
): LogReader {
  if (!name) throw new Error('A log consumer name is required');
  let state = readers.get(name);
  if (state?.open) throw new Error(`Log reader already open: ${name}`);
  if (!state) {
    state = {positions: new Map(), dropped: 0, open: false};
    readers.set(name, state);
  }
  const cursor = state;
  for (const buffer of getBuffers()) {
    if (!cursor.positions.has(buffer)) cursor.positions.set(buffer, buffer.baseIndex);
  }
  cursor.open = true;
  let closed = false;
  let selection: Selection | undefined;

  function refresh(): BufferState[] {
    const buffers = getBuffers();
    for (const buffer of buffers) {
      const position = cursor.positions.get(buffer) ?? buffer.baseIndex;
      if (buffer.baseIndex > position) {
        const protectedCount =
          selection?.rows
            .slice(selection.completed)
            .filter(
              (row) =>
                row.buffer === buffer && row.position >= position && row.position < buffer.baseIndex
            ).length ?? 0;
        cursor.dropped += buffer.baseIndex - position - protectedCount;
      }
      cursor.positions.set(buffer, Math.max(position, buffer.baseIndex));
    }

    return buffers;
  }

  function hasPending(): boolean {
    if (closed) return false;
    const buffers = refresh();

    return (
      Boolean(selection && selection.completed < selection.rows.length) ||
      buffers.some(
        (buffer) => cursor.positions.get(buffer)! < buffer.baseIndex + buffer.buffer.length
      )
    );
  }

  function releaseSelection(): void {
    refresh();
    if (!selection) return;
    cursor.dropped += selection.rows
      .slice(selection.completed)
      .filter((row) => row.position < row.buffer.baseIndex).length;
    selection = undefined;
  }

  function read({
    maxEstimatedBytes,
    maxRecords,
  }: {
    maxEstimatedBytes: number;
    maxRecords: number;
  }): LogReceipt | undefined {
    if (closed || selection) throw new Error('Log reader is closed or has a live receipt');
    if (
      !Number.isSafeInteger(maxRecords) ||
      maxRecords < 1 ||
      !Number.isSafeInteger(maxEstimatedBytes) ||
      maxEstimatedBytes < 1
    )
      throw new RangeError('Invalid log selection budget');
    const buffers = refresh();
    const positions = buffers.map((buffer) => cursor.positions.get(buffer)!);
    const rows: SelectedRecord[] = [];
    const observedTimestamp = Date.now();
    let estimatedBytes = 0;
    while (rows.length < maxRecords) {
      const heads = buffers.flatMap((buffer, index) => {
        const entry = buffer.buffer[positions[index] - buffer.baseIndex];
        const metadata = entry && entries.get(entry);
        if (entry && !metadata) throw new Error('Retained log is missing append metadata');

        return metadata ? [{buffer, index, entry, metadata}] : [];
      });
      if (!heads.length) break;
      const head = heads.reduce((first, item) =>
        item.metadata.seq < first.metadata.seq ? item : first
      );
      const record = snapshotRecord(head.entry, head.metadata, observedTimestamp);
      const size =
        (record.body.length +
          (record.eventName?.length ?? 0) +
          JSON.stringify(record.attributes).length) *
          2 +
        128;
      if (rows.length && estimatedBytes + size > maxEstimatedBytes) break;
      rows.push({buffer: head.buffer, position: positions[head.index], record});
      positions[head.index] += 1;
      estimatedBytes += size;
    }
    if (!rows.length) return undefined;
    const captured: Selection = {rows, completed: 0};
    selection = captured;

    function commit(completedRecords: number): void {
      if (selection !== captured) throw new Error('Log receipt is released');
      if (
        !Number.isSafeInteger(completedRecords) ||
        completedRecords < captured.completed ||
        completedRecords > rows.length
      )
        throw new RangeError('Invalid completed log prefix');
      refresh();
      for (const row of rows.slice(captured.completed, completedRecords)) {
        cursor.positions.set(
          row.buffer,
          Math.max(cursor.positions.get(row.buffer)!, row.position + 1)
        );
      }
      captured.completed = completedRecords;
    }

    function release(): void {
      if (selection !== captured) return;
      releaseSelection();
    }

    return Object.freeze({records: Object.freeze(rows.map((row) => row.record)), commit, release});
  }

  function close(): void {
    if (closed) return;
    releaseSelection();
    cursor.open = false;
    closed = true;
  }

  return {
    read,
    hasPending,
    close,
    get dropped() {
      if (!closed) refresh();

      return cursor.dropped;
    },
  };
}

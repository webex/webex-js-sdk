/** Captures filtered metadata and materializes independently owned records from retained buffer entries. */
export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Uint8Array
  | LogValue[]
  | LogAttributes;
export interface LogAttributes {
  [key: string]: LogValue | undefined;
}
export interface LogMetadata {
  readonly source?: string;
  readonly eventName?: string;
  readonly attributes?: Readonly<LogAttributes>;
}
export interface LogRecord extends LogMetadata {
  readonly sequence: number;
  readonly timestamp: number;
  readonly observedTimestamp: number;
  readonly level: string;
  readonly source: string;
  readonly body: string;
}
export type BufferEntryMetadata = Omit<LogRecord, 'body' | 'observedTimestamp'>;
type Redact = (value: unknown) => unknown;

function copyValue(value: unknown, redact: Redact, ancestors: Set<object>): LogValue | undefined {
  if (typeof value === 'string') return redact(value) as string;
  if (typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (!value || typeof value !== 'object' || ancestors.has(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
    return undefined;
  ancestors.add(value);
  const result = Array.isArray(value)
    ? Array.from(value, (item) => copyValue(item, redact, ancestors))
    : Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) => {
          const copied = copyValue(item, redact, ancestors);

          return key && copied !== undefined ? [[key, copied]] : [];
        })
      );
  ancestors.delete(value);

  return result;
}

/**
 * Copy supported metadata values without sharing mutable nested data.
 * @param {*} attributes - Candidate attribute map.
 * @param {Function} redact - Existing SDK filtering function.
 * @returns {LogAttributes} Owned attributes; invalid values are omitted.
 */
export function copyAttributes(
  attributes: unknown,
  redact: Redact = (value) => value
): LogAttributes {
  const value = copyValue(redact(attributes), redact, new Set());

  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array)
    ? (value as LogAttributes)
    : {};
}

/**
 * Capture only the explicit metadata for one log call.
 * @param {LogMetadata} metadata - Optional producer metadata.
 * @param {Function} redact - Existing SDK filtering function.
 * @returns {LogMetadata} Filtered metadata snapshot.
 */
export function captureMetadata(metadata: LogMetadata | undefined, redact: Redact): LogMetadata {
  const eventName =
    typeof metadata?.eventName === 'string' && metadata.eventName
      ? (redact(metadata.eventName) as string)
      : undefined;

  return Object.freeze({
    source:
      typeof metadata?.source === 'string' && metadata.source
        ? (redact(metadata.source) as string)
        : undefined,
    eventName,
    attributes: Object.freeze(copyAttributes(metadata?.attributes, redact)),
  });
}

/**
 * Materialize one record without exposing retained entry or metadata references.
 * @param {Object|string} bufferEntry - Retained entry or its formatted body.
 * @param {BufferEntryMetadata} metadata - Captured append metadata.
 * @param {number} observedTimestamp - Observation time in Unix milliseconds.
 * @returns {LogRecord} Independently owned structured record.
 */
export function snapshotRecord(
  bufferEntry: object | string,
  metadata: BufferEntryMetadata,
  observedTimestamp: number
): LogRecord {
  return Object.freeze({
    ...metadata,
    observedTimestamp,
    body: String(bufferEntry),
    attributes: Object.freeze(copyAttributes(metadata.attributes)),
  });
}

/**
 * Snapshot active buffers before materialization, merging FIFO heads by sequence.
 * @param {Array} buffers - Current SDK-owned log buffers.
 * @param {WeakMap} metadataByBufferEntry - Metadata associated with retained entries.
 * @returns {Array} Owned records sharing one observation timestamp.
 */
export function snapshotRecords(
  buffers: readonly {buffer: object[]}[],
  metadataByBufferEntry: WeakMap<object, BufferEntryMetadata>
): readonly LogRecord[] {
  const retainedBuffers = buffers.map(({buffer}) => [...buffer]);
  const positions = retainedBuffers.map(() => 0);
  const orderedEntries: {bufferEntry: object; metadata: BufferEntryMetadata}[] = [];

  while (true) {
    let next: (typeof orderedEntries)[number] | undefined;
    let selected = -1;

    for (let index = 0; index < retainedBuffers.length; index += 1) {
      const bufferEntry = retainedBuffers[index][positions[index]];

      if (bufferEntry) {
        const metadata = metadataByBufferEntry.get(bufferEntry);

        if (!metadata) throw new Error('Retained log is missing append metadata');
        if (!next || metadata.sequence < next.metadata.sequence) {
          next = {bufferEntry, metadata};
          selected = index;
        }
      }
    }
    if (!next) break;
    orderedEntries.push(next);
    positions[selected] += 1;
  }
  const observedTimestamp = Date.now();

  return Object.freeze(
    orderedEntries.map(({bufferEntry, metadata}) =>
      snapshotRecord(bufferEntry, metadata, observedTimestamp)
    )
  );
}

export interface StructuredLogging {
  logWithMetadata(level: string, metadata: LogMetadata, ...args: unknown[]): void;
  client_logWithMetadata(level: string, metadata: LogMetadata, ...args: unknown[]): void;
}

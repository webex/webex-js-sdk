/**
 * Record factory: captureMetadata filters producer fields when a log is accepted.
 * snapshotRecord and snapshotRecords give consumers owned copies of live records and history.
 */
import {cloneDeep} from 'lodash';

/** Portable metadata values. The SDK does not need a telemetry-library dependency. */
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
  [key: string]: LogValue;
}
/** Optional producer fields. Normal SDK log calls do not need these fields. */
export interface LogMetadata {
  readonly source?: string;
  readonly eventName?: string;
  readonly attributes?: Readonly<LogAttributes>;
}
export interface LogRecord extends LogMetadata {
  /** Logger-wide order. Increases once for each accepted buffered entry. */
  readonly sequence: number;
  /** Time the SDK accepted the entry, in Unix milliseconds. */
  readonly timestamp: number;
  /** Time the snapshot or live notification was created, in Unix milliseconds. */
  readonly observedTimestamp: number;
  /** Original SDK log level. The consumer maps it to its own severity. */
  readonly level: string;
  /** Producer label; defaults to sdk or client. It does not select the logging policy. */
  readonly source: string;
  /** Existing formatted text after SDK redaction. */
  readonly body: string;
}
/** Entry metadata kept outside the legacy buffer array. */
export type BufferEntryMetadata = Omit<LogRecord, 'body' | 'observedTimestamp'>;
type Redact = (value: unknown) => unknown;

/**
 * Copy supported values; omit cycles and values the record contract cannot represent.
 * @param {*} value - Candidate attribute value.
 * @param {Function} redact - Existing SDK filtering function.
 * @param {Set} ancestors - Objects on the current path; used to detect cycles.
 * @returns {LogValue} Owned value, or undefined when unsupported.
 */
function copyValue(value: unknown, redact: Redact, ancestors: Set<object>): LogValue {
  if (typeof value === 'string') {
    // The legacy filter skips repeated values. Filter each string to keep redaction complete.
    return redact(value) as string;
  }
  if (typeof value === 'boolean' || value === null) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }
  if (!value || typeof value !== 'object' || ancestors.has(value)) {
    return undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }
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
function copyAttributes(attributes: unknown, redact: Redact): LogAttributes {
  const value = copyValue(redact(attributes), redact, new Set());

  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array)
    ? (value as LogAttributes)
    : {};
}

/**
 * Filter and copy metadata once when the SDK accepts a log call.
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
 * Copy one accepted entry for a consumer. Its metadata is already filtered.
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
    attributes: Object.freeze(cloneDeep(metadata.attributes ?? {})),
  });
}

/**
 * Merge retained FIFO buffers by sequence and return owned records.
 * @param {Array} buffers - Current SDK-owned log buffers.
 * @param {WeakMap} metadataByBufferEntry - Metadata associated with retained entries.
 * @returns {Array} Owned records sharing one observation timestamp.
 * @throws {Error} If a retained entry has no captured metadata.
 */
export function snapshotRecords(
  buffers: readonly {buffer: object[]}[],
  metadataByBufferEntry: WeakMap<object, BufferEntryMetadata>
): readonly LogRecord[] {
  // Copy the buffers before converting entries so consumer work cannot change this snapshot.
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

        if (!metadata) {
          throw new Error('Retained log is missing append metadata');
        }
        if (!next || metadata.sequence < next.metadata.sequence) {
          next = {bufferEntry, metadata};
          selected = index;
        }
      }
    }
    if (!next) {
      break;
    }
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

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
  readonly timestamp?: number;
  readonly eventName?: string;
  readonly attributes?: Readonly<LogAttributes>;
}
export interface LogRecord extends LogMetadata {
  readonly seq: number;
  readonly timestamp: number;
  readonly observedTimestamp: number;
  readonly level: string;
  readonly source: string;
  readonly body: string;
}
export type EntryMetadata = Omit<LogRecord, 'body' | 'observedTimestamp'>;
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

export function captureMetadata(
  metadata: LogMetadata | undefined,
  context: Readonly<LogAttributes>,
  redact: Redact
): LogMetadata {
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
    attributes: Object.freeze({
      ...copyAttributes(metadata?.attributes, redact),
      ...copyAttributes(context),
    }),
  });
}

export function snapshotRecord(
  entry: object | string,
  metadata: EntryMetadata,
  observedTimestamp: number
): LogRecord {
  return Object.freeze({
    ...metadata,
    observedTimestamp,
    body: String(entry),
    attributes: Object.freeze(copyAttributes(metadata.attributes)),
  });
}

export interface StructuredLogging {
  logWithMetadata(level: string, metadata: LogMetadata, ...args: unknown[]): void;
  client_logWithMetadata(level: string, metadata: LogMetadata, ...args: unknown[]): void;
  client_logToBufferWithMetadata(level: string, metadata: LogMetadata, ...args: unknown[]): void;
}

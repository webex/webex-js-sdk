/** Public record contracts for consumers; the legacy Logger constructor remains unchanged. */
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
/**
 * Optional producer fields. Callers supply safe, serializable data.
 * Callers and consumers must leave these values unchanged after logging.
 */
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
  /** SDK acceptance time, in Unix milliseconds. Same as timestamp and fixed during replay. */
  readonly observedTimestamp: number;
  /** Original SDK log level. The consumer maps it to its own severity. */
  readonly level: string;
  /** Producer label; defaults to sdk or client. It does not select the logging policy. */
  readonly source: string;
  /** Existing formatted text after SDK redaction. */
  readonly body: string;
}

// Keep existing JavaScript callers and instance-type imports compatible.
declare const Logger: any;
type Logger = InstanceType<typeof Logger>;
export default Logger;
export declare const levels: string[];

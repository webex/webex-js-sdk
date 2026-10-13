export type {LogValue, LogAttributes, LogMetadata, LogRecord} from './src/log-record';
export type {StructuredLogging} from './src/log-record';
export type {LogEntries, LogEntryListener} from './src/log-entries';

// Preserve the existing untyped Ampersand constructor; the new ports have explicit types.
declare const Logger: any;
export default Logger;
export declare const levels: string[];

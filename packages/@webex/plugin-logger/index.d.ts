export type {LogValue, LogAttributes, LogMetadata, LogRecord} from './src/log-record';
export type {StructuredLogging} from './src/log-record';
export type {LogRecordSource, LogRecordListener} from './src/log-record-source';

// Preserve the legacy constructor in both value and instance-type positions.
declare const Logger: any;
type Logger = InstanceType<typeof Logger>;
export default Logger;
export declare const levels: string[];

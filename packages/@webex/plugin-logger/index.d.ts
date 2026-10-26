/** Public record contracts for consumers; the legacy Logger constructor remains unchanged. */
export type {LogValue, LogAttributes, LogMetadata, LogRecord} from './src/log-record';
export type {LogRecordSource, LogRecordListener} from './src/log-record-source';

// Keep existing JavaScript callers and instance-type imports compatible.
declare const Logger: any;
type Logger = InstanceType<typeof Logger>;
export default Logger;
export declare const levels: string[];

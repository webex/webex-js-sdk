import type {DropReason} from './validate';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Sink the SDK writes to. Defaults to the console for `warn` and `error` only. */
export interface LogSink {
  debug?: (message: string, context?: LogContext) => void;
  info?: (message: string, context?: LogContext) => void;
  warn?: (message: string, context?: LogContext) => void;
  error?: (message: string, context?: LogContext) => void;
}

/**
 * The complete set of fields that may be logged.
 *
 * Payloads and session tokens are absent by construction, not by convention: there
 * is no field to put them in, so payload logging is not reachable through the public
 * options (T11).
 */
export interface LogContext {
  channel?: string;
  kind?: string;
  topic?: string;
  id?: string;
  correlationId?: string | null;
  tabId?: number;
  reason?: DropReason | string;
  origin?: string;
  /** Which storage area a write failed against. A name, never a stored value. */
  store?: string;
  /** A bounded occurrence count, such as consecutive delivery failures. */
  count?: number;
}

export interface BridgeLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const CONTEXT_KEYS: readonly (keyof LogContext)[] = [
  'channel',
  'kind',
  'topic',
  'id',
  'correlationId',
  'tabId',
  'reason',
  'origin',
  'store',
  'count',
];

/**
 * Copy only known metadata fields onto a fresh object.
 *
 * Even though the type says otherwise, callers pass values that came off the wire, so
 * an extra field could otherwise smuggle a payload into a log sink.
 *
 * @param context - Candidate context.
 * @returns A context containing only allow-listed keys.
 */
export function pickLogContext(context?: LogContext): LogContext | undefined {
  if (!context) {
    return undefined;
  }

  const picked: LogContext = {};
  let found = false;

  for (const key of CONTEXT_KEYS) {
    const value = context[key];

    if (value !== undefined) {
      (picked as Record<string, unknown>)[key] = value;
      found = true;
    }
  }

  return found ? picked : undefined;
}

export interface CreateLoggerOptions {
  /** Enables `debug` and `info`. Metadata only either way. */
  debug?: boolean;
  sink?: LogSink;
  /** Prefixed to every message so bridge logs are greppable in a shared console. */
  prefix?: string;
}

/**
 * @param options - Logger options.
 * @returns A logger that is a no-op below `warn` unless `debug` is enabled.
 */
export function createLogger(options: CreateLoggerOptions = {}): BridgeLogger {
  const prefix = options.prefix ?? '[web-extension-bridge]';
  const {sink} = options;
  const verbose = options.debug === true;

  const write = (level: LogLevel, message: string, context?: LogContext): void => {
    const picked = pickLogContext(context);
    const line = `${prefix} ${message}`;
    const target = sink?.[level];

    if (target) {
      target(line, picked);

      return;
    }

    if (level === 'warn' || level === 'error') {
      // eslint-disable-next-line no-console
      console[level](line, picked ?? '');
    }
  };

  return {
    debug: (message, context) => {
      if (verbose) {
        write('debug', message, context);
      }
    },
    info: (message, context) => {
      if (verbose) {
        write('info', message, context);
      }
    },
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}

import type {DropReason} from './validate';

/** A level a line can actually be written at, in ascending verbosity. */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * A configured threshold: any {@link LogLevel}, plus `'silent'`.
 *
 * `'silent'` is the only way to suppress `warn` and `error` without handing over a
 * no-op sink, which is what a host with its own diagnostics channel had to do before.
 */
export type LogLevelSetting = LogLevel | 'silent';

/**
 * Sink the SDK writes to, in place of the console.
 *
 * Every method is optional, and supplying the sink at all hands it the whole
 * destination: a level left unwired is dropped rather than diverted to the console.
 * A host that wants both writes to the console from inside its own sink.
 */
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
 * Ascending verbosity. A line is emitted when its own rank is at or below the
 * configured threshold's, so one comparison covers every level.
 */
const LEVEL_RANK: Readonly<Record<LogLevelSetting, number>> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/** Warnings and errors, and nothing else. What an unconfigured bridge reports. */
export const DEFAULT_LOG_LEVEL: LogLevelSetting = 'warn';

/**
 * @param value - Candidate level.
 * @returns Whether `value` is a level this logger understands.
 */
function isLogLevelSetting(value: unknown): value is LogLevelSetting {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEVEL_RANK, value);
}

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
  /**
   * Lowest severity to emit. Defaults to {@link DEFAULT_LOG_LEVEL}.
   *
   * A threshold rather than a flag, so a host can keep lifecycle lines (`info`) in a
   * normal-operation log while leaving per-message detail (`debug`) off, and can turn
   * the bridge fully quiet with `'silent'`. Metadata only at every level.
   */
  logLevel?: LogLevelSetting;
  /** Alias for `logLevel: 'debug'`. Ignored when `logLevel` is given. */
  debug?: boolean;
  /** Replaces the console entirely when given. See {@link LogSink}. */
  sink?: LogSink;
  /** Prefixed to every message so bridge logs are greppable in a shared console. */
  prefix?: string;
}

/**
 * Resolve the threshold from the two ways of asking for one.
 *
 * `logLevel` wins over `debug`, because an explicit threshold is the more specific
 * request. An unrecognised value falls back to the default rather than throwing — a
 * mistyped log setting must not be the reason a bridge refuses to start — and the
 * caller is told, so it cannot be mistaken for logging that is merely quiet.
 *
 * @param options - Logger options.
 * @returns The resolved threshold, and whether the requested value was rejected.
 */
function resolveLogLevel(options: CreateLoggerOptions): {
  level: LogLevelSetting;
  invalid: boolean;
} {
  if (options.logLevel !== undefined) {
    return isLogLevelSetting(options.logLevel)
      ? {level: options.logLevel, invalid: false}
      : {level: DEFAULT_LOG_LEVEL, invalid: true};
  }

  return {level: options.debug === true ? 'debug' : DEFAULT_LOG_LEVEL, invalid: false};
}

/**
 * @param options - Logger options.
 * @returns A logger that emits at or below its configured threshold.
 */
export function createLogger(options: CreateLoggerOptions = {}): BridgeLogger {
  const prefix = options.prefix ?? '[web-extension-bridge]';
  const {sink} = options;
  const {level, invalid} = resolveLogLevel(options);
  const threshold = LEVEL_RANK[level];

  const write = (target: LogLevel, message: string, context?: LogContext): void => {
    if (LEVEL_RANK[target] > threshold) {
      return;
    }

    const picked = pickLogContext(context);
    const line = `${prefix} ${message}`;

    if (sink) {
      // A supplied sink owns the destination; consoling an unwired level would leak to the page.
      sink[target]?.(line, picked);

      return;
    }

    // No sink: the threshold already admitted this line, so it goes to the console.
    // eslint-disable-next-line no-console
    console[target](line, picked ?? '');
  };

  if (invalid) {
    // Bypasses `sink`: a host with no `warn` method would otherwise never learn of the typo.
    // eslint-disable-next-line no-console
    console.warn(`${prefix} unrecognised logLevel, falling back to '${DEFAULT_LOG_LEVEL}'`, {
      reason: 'UNRECOGNISED_LOG_LEVEL',
    });
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}

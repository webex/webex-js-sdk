import {CHANNEL_PATTERN, DEFAULT_CHANNEL} from '../core/constants';
import {BridgeError} from '../core/errors';
import {clampMaxPayloadBytes} from '../core/limits';
import type {LogSink} from '../core/logger';
import type {PageWindowLike} from './pageWindow';
import type {WebBridgeOptions} from '../types';

/** Exact origin: scheme, host, optional port, and nothing else. */
const EXACT_ORIGIN_PATTERN = /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?$/;

export interface ResolvedWebConfig {
  channel: string;
  allowedOrigins: Set<string>;
  /** Always the document's own origin: page and content script share one document. */
  targetOrigin: string;
  maxPayloadBytes: number;
  debug: boolean;
  logSink?: LogSink;
}

/**
 * Validate and normalise the page-side options.
 *
 * Everything here fails closed at construction. There is no development mode and no
 * wildcard escape hatch, because that is exactly how `localhost` and `'*'` end up in
 * production builds (spec 8.8).
 *
 * @param win - Page window, used for the default origin list and the target origin.
 * @param options - Caller options.
 * @returns Normalised configuration.
 * @throws BridgeError `INSECURE_CONFIG` for any rejected value.
 */
export function resolveWebConfig(
  win: PageWindowLike,
  options: WebBridgeOptions = {}
): ResolvedWebConfig {
  const channel = options.channel ?? DEFAULT_CHANNEL;

  if (typeof channel !== 'string' || !CHANNEL_PATTERN.test(channel)) {
    throw new BridgeError('INSECURE_CONFIG', 'channel must match ^[a-zA-Z0-9._:-]{1,128}$');
  }

  const documentOrigin = win.location.origin;
  const origins = options.allowedOrigins ?? [documentOrigin];

  if (!Array.isArray(origins) || origins.length === 0) {
    throw new BridgeError('INSECURE_CONFIG', 'allowedOrigins must be a non-empty array');
  }

  for (const origin of origins) {
    if (typeof origin !== 'string') {
      throw new BridgeError('INSECURE_CONFIG', 'allowedOrigins entries must be strings');
    }

    if (origin.includes('*')) {
      throw new BridgeError(
        'INSECURE_CONFIG',
        `'${origin}' contains a wildcard. List exact origins.`
      );
    }

    if (!EXACT_ORIGIN_PATTERN.test(origin)) {
      throw new BridgeError(
        'INSECURE_CONFIG',
        `'${origin}' is not an exact http(s) origin, for example https://app.example.com`
      );
    }
  }

  const allowedOrigins = new Set(origins);

  // The content script posts from within this document, so its `event.origin` is the
  // document's own origin. An allow-list without it can never connect; failing here
  // turns a silent no-op into a diagnosable error.
  if (!allowedOrigins.has(documentOrigin)) {
    throw new BridgeError(
      'INSECURE_CONFIG',
      `allowedOrigins must include this document's origin (${documentOrigin})`
    );
  }

  const config: ResolvedWebConfig = {
    channel,
    allowedOrigins,
    targetOrigin: documentOrigin,
    maxPayloadBytes: clampMaxPayloadBytes(options.maxPayloadBytes),
    debug: options.debug === true,
  };

  if (options.logSink) {
    config.logSink = options.logSink;
  }

  return config;
}

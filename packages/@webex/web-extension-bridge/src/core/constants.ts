/**
 * Wire protocol version. Versioned independently of the package (NFR8): a peer
 * running a different value is refused rather than best-effort tolerated.
 */
export const PROTOCOL_VERSION = 1;

/** Envelope marker, so each side can ignore unrelated `postMessage` traffic cheaply. */
export const ENVELOPE_MARKER = '__webexBridge';

/** Default channel namespace. Independent bridges on one page use distinct channels (FR7). */
export const DEFAULT_CHANNEL = 'webex-bridge';

/** Topic used by handshake and lifecycle envelopes, which carry no product topic. */
export const CONTROL_TOPIC = 'bridge.control';

/** Routing keys are constrained so a topic can never be confused for a path or a selector. */
export const TOPIC_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

/** Channel names share the topic charset. */
export const CHANNEL_PATTERN = TOPIC_PATTERN;

export const MAX_ID_LENGTH = 128;

export const DEFAULT_MAX_PAYLOAD_BYTES = 262144;
export const MAX_PAYLOAD_BYTES_CEILING = 1048576;

export const DEFAULT_TIMEOUT_MS = 5000;
export const MIN_TIMEOUT_MS = 100;
export const MAX_TIMEOUT_MS = 30000;

/** Envelopes timestamped outside this window are treated as replayed captures. */
export const CLOCK_SKEW_TOLERANCE_MS = 30000;

// Seen-id cache bounds — unbounded replay caches are a leak in a long-lived worker.
export const SEEN_ID_MAX_ENTRIES = 500;
export const SEEN_ID_TTL_MS = 60000;

/** FR8 replay buffer defaults (spec decision D4). */
export const DEFAULT_BUFFER_MAX_ENTRIES = 200;
export const DEFAULT_BUFFER_TTL_MS = 1800000;

/** Rate limiting defaults, per `(tabId, topic)` for pushes and per tab for requests. */
export const DEFAULT_PUSHES_PER_SECOND = 20;
export const DEFAULT_MAX_IN_FLIGHT_PER_TAB = 16;
export const RATE_LIMIT_MAX_KEYS = 256;

/**
 * Bounds the per-tab aggregate rate as a multiple of the per-topic rate, so a page
 * cycling unique topic names (each getting a fresh bucket) is still capped overall.
 */
export const RATE_LIMIT_AGGREGATE_MULTIPLIER = 4;

/** Aggregate buckets are keyed per tab, so this map is far smaller than the topic map. */
export const RATE_LIMIT_AGGREGATE_MAX_KEYS = 64;

// Numeric option bounds. Rejected at construction rather than clamped, since silently
// reinterpreting a misconfigured number is how rate limiting ends up disabled.
export const MIN_RATE_PER_SECOND = 1;
export const MAX_RATE_PER_SECOND = 10000;
export const MIN_BUFFER_ENTRIES = 1;
export const MAX_BUFFER_ENTRIES = 10000;
export const MIN_BUFFER_TTL_MS = 1000;
export const MAX_BUFFER_TTL_MS = 86400000;
export const MIN_IN_FLIGHT_PER_TAB = 1;
export const MAX_IN_FLIGHT_PER_TAB = 1024;

/**
 * Total serialised bytes the replay buffer may hold, enforced alongside the entry cap.
 * `chrome.storage.session`'s quota (10 MiB) is fixed and its write failures are async,
 * so an entry cap alone isn't a bound (200 entries at the 1 MiB ceiling is 200 MiB).
 */
export const DEFAULT_BUFFER_MAX_BYTES = 4194304;
export const MIN_BUFFER_MAX_BYTES = 1024;
export const MAX_BUFFER_MAX_BYTES = 8388608;

/** Listener sets are bounded: a leaking consumer must not grow the worker without limit. */
export const MAX_LISTENERS = 64;

/**
 * Keys that must never appear as envelope keys, or anywhere inside a payload.
 * Rejecting them is cheaper and more auditable than sanitising them away.
 */
export const RESERVED_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/**
 * The content script re-announces `HELLO` once after this delay, so a page bridge
 * that constructs after `document_start` injection still gets a session token.
 */
export const HELLO_REANNOUNCE_DELAY_MS = 250;

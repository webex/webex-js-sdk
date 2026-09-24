"use strict";
var WebExtensionBridge = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    BRIDGE_ERROR_CODES: () => BRIDGE_ERROR_CODES,
    BridgeError: () => BridgeError,
    DEFAULT_CHANNEL: () => DEFAULT_CHANNEL,
    EnvelopeKind: () => EnvelopeKind,
    EnvelopeSource: () => EnvelopeSource,
    PROTOCOL_VERSION: () => PROTOCOL_VERSION,
    createWebBridge: () => createWebBridge,
    isBridgeError: () => isBridgeError
  });

  // src/core/constants.ts
  var PROTOCOL_VERSION = 1;
  var ENVELOPE_MARKER = "__webexBridge";
  var DEFAULT_CHANNEL = "webex-bridge";
  var CONTROL_TOPIC = "bridge.control";
  var TOPIC_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
  var CHANNEL_PATTERN = TOPIC_PATTERN;
  var MAX_ID_LENGTH = 128;
  var DEFAULT_MAX_PAYLOAD_BYTES = 262144;
  var MAX_PAYLOAD_BYTES_CEILING = 1048576;
  var CLOCK_SKEW_TOLERANCE_MS = 3e4;
  var SEEN_ID_MAX_ENTRIES = 500;
  var SEEN_ID_TTL_MS = 6e4;
  var MAX_LISTENERS = 64;
  var RESERVED_KEYS = ["__proto__", "constructor", "prototype"];

  // src/core/json.ts
  function nullPrototypeRecord() {
    return /* @__PURE__ */ Object.create(null);
  }
  function readOwn(source, key) {
    if (typeof source !== "object" || source === null) {
      return void 0;
    }
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return void 0;
    }
    return source[key];
  }
  var MAX_WALK_DEPTH = 64;
  var JsonRejection = {
    /** A value outside the {@link JsonValue} grammar: function, symbol, `undefined`,
     *  `NaN`/`Infinity`, `BigInt`, `Date`, class instance, and so on. */
    NOT_JSON: "NOT_JSON",
    /** A reserved key appeared as an own property name somewhere in the value. */
    RESERVED_KEY: "RESERVED_KEY",
    /** Nesting exceeded {@link MAX_WALK_DEPTH}, so the value could not be fully checked. */
    TOO_DEEP: "TOO_DEEP",
    /** The value refers back to itself. */
    CYCLE: "CYCLE",
    /**
     * The value's *expanded* form is over budget. A shared subtree counts once in memory
     * but once per referencing path in JSON, so this can fire for a value that looks small.
     */
    TOO_LARGE: "TOO_LARGE"
  };
  var OBJECT_PROTOTYPE = Object.prototype;
  var ARRAY_PROTOTYPE = Array.prototype;
  function isPlainObject(node) {
    const proto = Object.getPrototypeOf(node);
    return proto === OBJECT_PROTOTYPE || proto === null;
  }
  function inspectJson(value, reserved, maxExpandedNodes = Number.MAX_SAFE_INTEGER) {
    const ancestors = /* @__PURE__ */ new Set();
    const cleared = /* @__PURE__ */ new Map();
    const LEAF = 1;
    const cap = maxExpandedNodes + 1;
    const add = (a, b) => Math.min(a + b, cap);
    const walk = (node, depth) => {
      if (node === null) {
        return { ok: true, weight: LEAF };
      }
      const type = typeof node;
      if (type === "string") {
        return { ok: true, weight: Math.min(node.length + 2, cap) };
      }
      if (type === "boolean") {
        return { ok: true, weight: LEAF };
      }
      if (type === "number") {
        return Number.isFinite(node) ? { ok: true, weight: LEAF } : { ok: false, rejection: JsonRejection.NOT_JSON };
      }
      if (type !== "object") {
        return { ok: false, rejection: JsonRejection.NOT_JSON };
      }
      const object = node;
      if (ancestors.has(object)) {
        return { ok: false, rejection: JsonRejection.CYCLE };
      }
      const memo = cleared.get(object);
      if (memo && depth <= memo.depth) {
        return { ok: true, weight: memo.weight };
      }
      if (depth >= MAX_WALK_DEPTH) {
        return { ok: false, rejection: JsonRejection.TOO_DEEP };
      }
      ancestors.add(object);
      try {
        const result2 = walkOwnProperties(object, depth);
        if (result2.ok) {
          if (result2.weight > maxExpandedNodes) {
            return { ok: false, rejection: JsonRejection.TOO_LARGE };
          }
          cleared.set(object, { depth, weight: result2.weight });
        }
        return result2;
      } finally {
        ancestors.delete(object);
      }
    };
    const walkOwnProperties = (object, depth) => {
      if (Object.getPrototypeOf(object) === ARRAY_PROTOTYPE) {
        const items = object;
        let weight2 = LEAF;
        for (let index = 0; index < items.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(items, index);
          if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
            return { ok: false, rejection: JsonRejection.NOT_JSON };
          }
          const found = walk(descriptor.value, depth + 1);
          if (!found.ok) {
            return found;
          }
          weight2 = add(weight2, found.weight);
          if (weight2 > maxExpandedNodes) {
            return { ok: false, rejection: JsonRejection.TOO_LARGE };
          }
        }
        if (Object.getOwnPropertyNames(items).length !== items.length + 1) {
          return { ok: false, rejection: JsonRejection.NOT_JSON };
        }
        return symbolCheck(items, weight2);
      }
      if (!isPlainObject(object)) {
        return { ok: false, rejection: JsonRejection.NOT_JSON };
      }
      let weight = LEAF;
      for (const key of Object.getOwnPropertyNames(object)) {
        if (reserved.includes(key)) {
          return { ok: false, rejection: JsonRejection.RESERVED_KEY, key };
        }
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
          return { ok: false, rejection: JsonRejection.NOT_JSON };
        }
        const found = walk(descriptor.value, depth + 1);
        if (!found.ok) {
          return found;
        }
        weight = add(add(weight, found.weight), key.length + 3);
        if (weight > maxExpandedNodes) {
          return { ok: false, rejection: JsonRejection.TOO_LARGE };
        }
      }
      return symbolCheck(object, weight);
    };
    const result = walk(value, 0);
    return result.ok ? { ok: true } : result;
  }
  function symbolCheck(object, weight) {
    return Object.getOwnPropertySymbols(object).length > 0 ? { ok: false, rejection: JsonRejection.NOT_JSON } : { ok: true, weight };
  }

  // src/core/counters.ts
  var CounterName = {
    PUSH_SENT: "pushSent",
    PUSH_RECEIVED: "pushReceived",
    REQUEST_ISSUED: "requestIssued",
    REQUEST_SERVED: "requestServed",
    REQUEST_FAILED: "requestFailed",
    DROPPED: "dropped",
    RATE_LIMITED: "rateLimited",
    /** A push the content relay refused before it ever reached the worker. */
    RELAY_DROPPED: "relayDropped",
    /** A `runtime.sendMessage` from the relay to the worker that never arrived. */
    RELAY_SEND_FAILED: "relaySendFailed",
    /** A `chrome.storage.session` write the platform refused. */
    STORAGE_WRITE_FAILED: "storageWriteFailed"
  };
  var Counters = class {
    constructor() {
      this.values = nullPrototypeRecord();
    }
    /**
     * @param name - Counter name.
     * @param detail - Optional suffix, such as an error code or drop reason.
     * @param by - Increment amount.
     */
    increment(name, detail, by = 1) {
      const key = detail === void 0 ? name : `${name}.${detail}`;
      this.values[key] = (this.values[key] ?? 0) + by;
    }
    /**
     * @returns A copy of the current counts, safe to hand to a consumer.
     */
    snapshot() {
      return Object.assign(nullPrototypeRecord(), this.values);
    }
    /** Clear every counter back to zero. */
    reset() {
      this.values = nullPrototypeRecord();
    }
  };

  // src/core/errors.ts
  var BRIDGE_ERROR_CODES = [
    "NOT_CONNECTED",
    "NO_TAB",
    "NO_HANDLER",
    "TIMEOUT",
    "DISCONNECTED",
    "ABORTED",
    "HANDLER_ERROR",
    "INVALID_PAYLOAD",
    "INVALID_TOPIC",
    "RATE_LIMITED",
    "PROTOCOL_MISMATCH",
    "INSECURE_CONFIG",
    "CRYPTO_UNAVAILABLE"
  ];
  var KNOWN_CODES = new Set(BRIDGE_ERROR_CODES);
  var REDACTED_MESSAGES = /* @__PURE__ */ new Map([
    ["NOT_CONNECTED", "No bridge is attached in the target tab"],
    ["NO_TAB", "No target tab could be resolved"],
    ["NO_HANDLER", "No handler is registered for this topic"],
    ["TIMEOUT", "The peer did not respond in time"],
    ["DISCONNECTED", "The peer went away before the request settled"],
    ["ABORTED", "The request was aborted by the caller"],
    ["HANDLER_ERROR", "The handler failed"],
    ["INVALID_PAYLOAD", "The payload failed validation"],
    ["INVALID_TOPIC", "The topic failed validation"],
    ["RATE_LIMITED", "The message was rejected by the rate limiter"],
    ["PROTOCOL_MISMATCH", "The peer runs an incompatible protocol version"],
    ["INSECURE_CONFIG", "The configuration was rejected"],
    ["CRYPTO_UNAVAILABLE", "No cryptographically secure random source is available"]
  ]);
  var BridgeError = class extends Error {
    /**
     * @param code - Stable failure code.
     * @param message - Optional detail. Never crosses a trust boundary; use
     *   {@link toWireError} for that.
     * @param topic - Topic the failure relates to, when there is one.
     */
    constructor(code, message, topic) {
      super(message ?? REDACTED_MESSAGES.get(code) ?? code);
      this.name = "BridgeError";
      this.code = code;
      if (topic !== void 0) {
        this.topic = topic;
      }
    }
  };
  function isBridgeError(value) {
    return value instanceof BridgeError;
  }
  function toWireError(cause) {
    const code = isBridgeError(cause) ? cause.code : "HANDLER_ERROR";
    return {
      code,
      message: REDACTED_MESSAGES.get(code) ?? "The request failed"
    };
  }

  // src/core/ids.ts
  function isUsableCrypto(source) {
    if (typeof source !== "object" || source === null) {
      return false;
    }
    const candidate = source;
    return typeof candidate.randomUUID === "function" || typeof candidate.getRandomValues === "function";
  }
  function createIdFactory(source) {
    const cryptoObj = source ?? (typeof globalThis === "undefined" ? void 0 : globalThis.crypto);
    if (!isUsableCrypto(cryptoObj)) {
      throw new BridgeError("CRYPTO_UNAVAILABLE");
    }
    const { randomUUID, getRandomValues } = cryptoObj;
    if (typeof randomUUID === "function") {
      return () => randomUUID.call(cryptoObj);
    }
    return () => {
      const bytes = getRandomValues.call(
        cryptoObj,
        new Uint8Array(16)
      );
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    };
  }

  // src/core/listeners.ts
  var ListenerSet = class {
    /**
     * @param options - Size cap and the sink for whatever a listener throws.
     */
    constructor(options = {}) {
      this.listeners = /* @__PURE__ */ new Set();
      this.maxListeners = options.maxListeners ?? MAX_LISTENERS;
      if (options.onError) {
        this.onError = options.onError;
      }
    }
    /**
     * @param listener - Listener to add. Adding the same function twice is a no-op.
     * @returns An unsubscribe function, safe to call more than once.
     * @throws RangeError when adding a new listener would exceed `maxListeners`.
     */
    add(listener) {
      if (this.listeners.size >= this.maxListeners && !this.listeners.has(listener)) {
        throw new RangeError(`Refusing to add more than ${this.maxListeners} listeners`);
      }
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    /**
     * Deliver to every listener, isolated per-listener (see class doc).
     *
     * @param args - Arguments passed to every listener.
     */
    emit(...args) {
      for (const listener of [...this.listeners]) {
        try {
          listener(...args);
        } catch (error) {
          this.onError?.(error);
        }
      }
    }
    /** Remove every listener. */
    clear() {
      this.listeners.clear();
    }
    /** Number of registered listeners. */
    get size() {
      return this.listeners.size;
    }
  };

  // src/core/logger.ts
  var CONTEXT_KEYS = [
    "channel",
    "kind",
    "topic",
    "id",
    "correlationId",
    "tabId",
    "reason",
    "origin",
    "store",
    "count"
  ];
  var LEVEL_RANK = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
  };
  var DEFAULT_LOG_LEVEL = "warn";
  function isLogLevelSetting(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEVEL_RANK, value);
  }
  function pickLogContext(context) {
    if (!context) {
      return void 0;
    }
    const picked = {};
    let found = false;
    for (const key of CONTEXT_KEYS) {
      const value = context[key];
      if (value !== void 0) {
        picked[key] = value;
        found = true;
      }
    }
    return found ? picked : void 0;
  }
  function resolveLogLevel(options) {
    if (options.logLevel !== void 0) {
      return isLogLevelSetting(options.logLevel) ? { level: options.logLevel, invalid: false } : { level: DEFAULT_LOG_LEVEL, invalid: true };
    }
    return { level: options.debug === true ? "debug" : DEFAULT_LOG_LEVEL, invalid: false };
  }
  function createLogger(options = {}) {
    const prefix = options.prefix ?? "[web-extension-bridge]";
    const { sink } = options;
    const { level, invalid } = resolveLogLevel(options);
    const threshold = LEVEL_RANK[level];
    const write = (target, message, context) => {
      if (LEVEL_RANK[target] > threshold) {
        return;
      }
      const picked = pickLogContext(context);
      const line = `${prefix} ${message}`;
      if (sink) {
        sink[target]?.(line, picked);
        return;
      }
      console[target](line, picked ?? "");
    };
    if (invalid) {
      console.warn(`${prefix} unrecognised logLevel, falling back to '${DEFAULT_LOG_LEVEL}'`, {
        reason: "UNRECOGNISED_LOG_LEVEL"
      });
    }
    return {
      debug: (message, context) => write("debug", message, context),
      info: (message, context) => write("info", message, context),
      warn: (message, context) => write("warn", message, context),
      error: (message, context) => write("error", message, context)
    };
  }

  // src/core/protocol.ts
  var EnvelopeKind = {
    HELLO: "HELLO",
    HELLO_ACK: "HELLO_ACK",
    PUSH: "PUSH",
    REQUEST: "REQUEST",
    RESPONSE: "RESPONSE",
    BYE: "BYE"
  };
  var ENVELOPE_KINDS = [
    EnvelopeKind.HELLO,
    EnvelopeKind.HELLO_ACK,
    EnvelopeKind.PUSH,
    EnvelopeKind.REQUEST,
    EnvelopeKind.RESPONSE,
    EnvelopeKind.BYE
  ];
  var EnvelopeSource = {
    PAGE: "page",
    EXTENSION: "extension"
  };
  function createEnvelope(input) {
    const envelope = /* @__PURE__ */ Object.create(null);
    envelope[ENVELOPE_MARKER] = true;
    envelope.v = PROTOCOL_VERSION;
    envelope.channel = input.channel;
    envelope.kind = input.kind;
    envelope.source = input.source;
    envelope.topic = input.topic;
    envelope.id = input.id;
    envelope.correlationId = input.correlationId ?? null;
    envelope.session = input.session;
    envelope.ts = input.ts ?? Date.now();
    if (input.payload !== void 0) {
      envelope.payload = input.payload;
    }
    if (input.ok !== void 0) {
      envelope.ok = input.ok;
    }
    if (input.error !== void 0) {
      envelope.error = input.error;
    }
    return envelope;
  }

  // src/core/replay.ts
  var SeenIds = class {
    /**
     * @param options - Cache bounds and clock. Defaults come from `core/constants`.
     */
    constructor(options = {}) {
      this.entries = /* @__PURE__ */ new Map();
      this.maxEntries = options.maxEntries ?? SEEN_ID_MAX_ENTRIES;
      this.ttlMs = options.ttlMs ?? SEEN_ID_TTL_MS;
      this.now = options.now ?? (() => Date.now());
    }
    /**
     * Record an id, reporting whether it is the first sighting.
     *
     * @param id - Envelope id.
     * @returns `true` when the id is new, `false` when it is a replay.
     */
    accept(id) {
      const at = this.now();
      this.evictExpired(at);
      const existing = this.entries.get(id);
      if (existing !== void 0) {
        return false;
      }
      this.entries.set(id, at);
      while (this.entries.size > this.maxEntries) {
        const oldest = this.entries.keys().next();
        if (oldest.done) {
          break;
        }
        this.entries.delete(oldest.value);
      }
      return true;
    }
    /**
     * @param id - Envelope id.
     * @returns Whether the id is currently cached.
     */
    has(id) {
      this.evictExpired(this.now());
      return this.entries.has(id);
    }
    /** Forget every cached id. */
    clear() {
      this.entries.clear();
    }
    /** Number of currently cached ids. */
    get size() {
      return this.entries.size;
    }
    /**
     * Drop every entry older than the TTL, oldest first.
     *
     * @param at - Current time.
     */
    evictExpired(at) {
      for (const [id, seenAt] of this.entries) {
        if (at - seenAt < this.ttlMs) {
          break;
        }
        this.entries.delete(id);
      }
    }
  };
  function isWithinClockSkew(ts, now, toleranceMs = CLOCK_SKEW_TOLERANCE_MS) {
    if (typeof ts !== "number" || !Number.isFinite(ts)) {
      return false;
    }
    return Math.abs(now - ts) <= toleranceMs;
  }

  // src/core/serialize.ts
  var encoder;
  function utf8ByteLength(text) {
    if (typeof TextEncoder === "undefined") {
      throw new BridgeError("INSECURE_CONFIG", "TextEncoder is required to measure payload size");
    }
    if (!encoder) {
      encoder = new TextEncoder();
    }
    return encoder.encode(text).length;
  }
  var PayloadRejection = {
    NOT_SERIALISABLE: "NOT_SERIALISABLE",
    TOO_LARGE: "TOO_LARGE",
    RESERVED_KEY: "RESERVED_KEY",
    /** Nested past {@link MAX_WALK_DEPTH}, so the value could not be fully validated. */
    TOO_DEEP: "TOO_DEEP"
  };
  var REJECTION_FOR = /* @__PURE__ */ new Map([
    [JsonRejection.NOT_JSON, PayloadRejection.NOT_SERIALISABLE],
    [JsonRejection.CYCLE, PayloadRejection.NOT_SERIALISABLE],
    [JsonRejection.RESERVED_KEY, PayloadRejection.RESERVED_KEY],
    [JsonRejection.TOO_DEEP, PayloadRejection.TOO_DEEP],
    [JsonRejection.TOO_LARGE, PayloadRejection.TOO_LARGE]
  ]);
  function checkPayload(payload, maxBytes) {
    if (payload === void 0) {
      return { ok: true, bytes: 0 };
    }
    let structure;
    try {
      structure = inspectJson(payload, RESERVED_KEYS, maxBytes);
    } catch {
      return { ok: false, rejection: PayloadRejection.NOT_SERIALISABLE };
    }
    if (!structure.ok) {
      const rejection = REJECTION_FOR.get(structure.rejection) ?? PayloadRejection.NOT_SERIALISABLE;
      return structure.key === void 0 ? { ok: false, rejection } : { ok: false, rejection, key: structure.key };
    }
    let serialised;
    try {
      serialised = JSON.stringify(payload);
    } catch {
      return { ok: false, rejection: PayloadRejection.NOT_SERIALISABLE };
    }
    if (typeof serialised !== "string") {
      return { ok: false, rejection: PayloadRejection.NOT_SERIALISABLE };
    }
    const bytes = utf8ByteLength(serialised);
    if (bytes > maxBytes) {
      return { ok: false, rejection: PayloadRejection.TOO_LARGE };
    }
    return { ok: true, bytes };
  }
  function assertPayload(payload, maxBytes, topic) {
    const result = checkPayload(payload, maxBytes);
    if (!result.ok) {
      throw new BridgeError("INVALID_PAYLOAD", `Payload rejected: ${result.rejection}`, topic);
    }
  }
  function isValidTopic(topic) {
    return typeof topic === "string" && TOPIC_PATTERN.test(topic);
  }
  function assertTopic(topic) {
    if (!isValidTopic(topic)) {
      throw new BridgeError("INVALID_TOPIC", "Topic must match ^[a-zA-Z0-9._:-]{1,128}$");
    }
  }
  function asJsonValue(payload) {
    return payload;
  }

  // src/core/validate.ts
  var DropReason = {
    NOT_AN_ENVELOPE: "NOT_AN_ENVELOPE",
    RESERVED_KEY: "RESERVED_KEY",
    VERSION_MISMATCH: "VERSION_MISMATCH",
    CHANNEL_MISMATCH: "CHANNEL_MISMATCH",
    UNKNOWN_KIND: "UNKNOWN_KIND",
    KIND_NOT_ALLOWED: "KIND_NOT_ALLOWED",
    INVALID_SOURCE: "INVALID_SOURCE",
    INVALID_ID: "INVALID_ID",
    INVALID_CORRELATION_ID: "INVALID_CORRELATION_ID",
    INVALID_TOPIC: "INVALID_TOPIC",
    SESSION_MISMATCH: "SESSION_MISMATCH",
    CLOCK_SKEW: "CLOCK_SKEW",
    REPLAYED_ID: "REPLAYED_ID",
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
    PAYLOAD_NOT_SERIALISABLE: "PAYLOAD_NOT_SERIALISABLE",
    PAYLOAD_TOO_DEEP: "PAYLOAD_TOO_DEEP",
    INVALID_RESULT: "INVALID_RESULT",
    INVALID_ERROR: "INVALID_ERROR"
  };
  var drop = (reason) => ({ ok: false, reason });
  var KIND_SET = new Set(ENVELOPE_KINDS);
  var WIRE_ERROR_KEYS = /* @__PURE__ */ new Set(["code", "message"]);
  function isValidWireError(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    for (const key of Object.getOwnPropertyNames(value)) {
      if (RESERVED_KEYS.includes(key) || !WIRE_ERROR_KEYS.has(key)) {
        return false;
      }
    }
    const code = readOwn(value, "code");
    if (typeof code !== "string" || code.length < 1 || code.length > MAX_ID_LENGTH) {
      return false;
    }
    const message = readOwn(value, "message");
    return message === void 0 || typeof message === "string" && message.length <= MAX_ID_LENGTH;
  }
  function validateEnvelope(value, context) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return drop(DropReason.NOT_AN_ENVELOPE);
    }
    if (readOwn(value, ENVELOPE_MARKER) !== true) {
      return drop(DropReason.NOT_AN_ENVELOPE);
    }
    for (const key of Object.getOwnPropertyNames(value)) {
      if (RESERVED_KEYS.includes(key)) {
        return drop(DropReason.RESERVED_KEY);
      }
    }
    if (readOwn(value, "v") !== PROTOCOL_VERSION) {
      return drop(DropReason.VERSION_MISMATCH);
    }
    if (readOwn(value, "channel") !== context.channel) {
      return drop(DropReason.CHANNEL_MISMATCH);
    }
    const kind = readOwn(value, "kind");
    if (typeof kind !== "string" || !KIND_SET.has(kind)) {
      return drop(DropReason.UNKNOWN_KIND);
    }
    if (context.allowedKinds && !context.allowedKinds.includes(kind)) {
      return drop(DropReason.KIND_NOT_ALLOWED);
    }
    if (readOwn(value, "source") !== context.expectedSource) {
      return drop(DropReason.INVALID_SOURCE);
    }
    const id = readOwn(value, "id");
    if (typeof id !== "string" || id.length < 1 || id.length > MAX_ID_LENGTH) {
      return drop(DropReason.INVALID_ID);
    }
    const correlationId = readOwn(value, "correlationId");
    if (correlationId !== null && (typeof correlationId !== "string" || correlationId.length < 1 || correlationId.length > MAX_ID_LENGTH)) {
      return drop(DropReason.INVALID_CORRELATION_ID);
    }
    if (kind !== EnvelopeKind.RESPONSE && correlationId !== null) {
      return drop(DropReason.INVALID_CORRELATION_ID);
    }
    const topic = readOwn(value, "topic");
    if (!isValidTopic(topic)) {
      return drop(DropReason.INVALID_TOPIC);
    }
    const session = readOwn(value, "session");
    if (typeof session !== "string" || session.length > MAX_ID_LENGTH) {
      return drop(DropReason.SESSION_MISMATCH);
    }
    const establishesSession = kind === EnvelopeKind.HELLO || kind === EnvelopeKind.HELLO_ACK && context.session === null;
    if (!establishesSession && (context.session === null || session !== context.session)) {
      return drop(DropReason.SESSION_MISMATCH);
    }
    const ts = readOwn(value, "ts");
    if (!isWithinClockSkew(ts, context.now, context.clockSkewToleranceMs ?? CLOCK_SKEW_TOLERANCE_MS)) {
      return drop(DropReason.CLOCK_SKEW);
    }
    const payloadCheck = checkPayload(readOwn(value, "payload"), context.maxPayloadBytes);
    if (!payloadCheck.ok) {
      if (payloadCheck.rejection === PayloadRejection.TOO_LARGE) {
        return drop(DropReason.PAYLOAD_TOO_LARGE);
      }
      if (payloadCheck.rejection === PayloadRejection.RESERVED_KEY) {
        return drop(DropReason.RESERVED_KEY);
      }
      if (payloadCheck.rejection === PayloadRejection.TOO_DEEP) {
        return drop(DropReason.PAYLOAD_TOO_DEEP);
      }
      return drop(DropReason.PAYLOAD_NOT_SERIALISABLE);
    }
    if (kind === EnvelopeKind.RESPONSE) {
      const ok = readOwn(value, "ok");
      if (typeof ok !== "boolean") {
        return drop(DropReason.INVALID_RESULT);
      }
      if (correlationId === null) {
        return drop(DropReason.INVALID_CORRELATION_ID);
      }
      if (ok === false && !isValidWireError(readOwn(value, "error"))) {
        return drop(DropReason.INVALID_ERROR);
      }
    }
    if (context.seenIds && !context.seenIds.accept(id)) {
      return drop(DropReason.REPLAYED_ID);
    }
    return { ok: true, envelope: value };
  }

  // src/core/limits.ts
  function clampMaxPayloadBytes(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_MAX_PAYLOAD_BYTES;
    }
    return Math.min(Math.max(Math.floor(value), 1), MAX_PAYLOAD_BYTES_CEILING);
  }

  // src/web/config.ts
  var EXACT_ORIGIN_PATTERN = /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?$/;
  function resolveWebConfig(win, options = {}) {
    const channel = options.channel ?? DEFAULT_CHANNEL;
    if (typeof channel !== "string" || !CHANNEL_PATTERN.test(channel)) {
      throw new BridgeError("INSECURE_CONFIG", "channel must match ^[a-zA-Z0-9._:-]{1,128}$");
    }
    const documentOrigin = win.location.origin;
    const origins = options.allowedOrigins ?? [documentOrigin];
    if (!Array.isArray(origins) || origins.length === 0) {
      throw new BridgeError("INSECURE_CONFIG", "allowedOrigins must be a non-empty array");
    }
    for (const origin of origins) {
      if (typeof origin !== "string") {
        throw new BridgeError("INSECURE_CONFIG", "allowedOrigins entries must be strings");
      }
      if (origin.includes("*")) {
        throw new BridgeError(
          "INSECURE_CONFIG",
          `'${origin}' contains a wildcard. List exact origins.`
        );
      }
      if (!EXACT_ORIGIN_PATTERN.test(origin)) {
        throw new BridgeError(
          "INSECURE_CONFIG",
          `'${origin}' is not an exact http(s) origin, for example https://app.example.com`
        );
      }
    }
    const allowedOrigins = new Set(origins);
    if (!allowedOrigins.has(documentOrigin)) {
      throw new BridgeError(
        "INSECURE_CONFIG",
        `allowedOrigins must include this document's origin (${documentOrigin})`
      );
    }
    const config = {
      channel,
      allowedOrigins,
      targetOrigin: documentOrigin,
      maxPayloadBytes: clampMaxPayloadBytes(options.maxPayloadBytes),
      debug: options.debug === true
    };
    if (options.logLevel !== void 0) {
      config.logLevel = options.logLevel;
    }
    if (options.logSink) {
      config.logSink = options.logSink;
    }
    return config;
  }

  // src/web/pageWindow.ts
  function resolvePageWindow() {
    const candidate = typeof window === "undefined" ? void 0 : window;
    if (!candidate) {
      throw new BridgeError(
        "INSECURE_CONFIG",
        "createWebBridge requires a browser window. Use the extension entry points instead."
      );
    }
    return candidate;
  }

  // src/web/webBridge.ts
  var ACCEPTED_KINDS = [
    EnvelopeKind.HELLO,
    EnvelopeKind.HELLO_ACK,
    EnvelopeKind.REQUEST,
    EnvelopeKind.BYE
  ];
  function createWebBridge(options) {
    return createWebBridgeWith(resolvePageWindow(), options);
  }
  function createWebBridgeWith(win, options = {}) {
    const config = resolveWebConfig(win, options);
    const nextId = createIdFactory();
    const logger = createLogger({
      debug: config.debug,
      ...config.logLevel === void 0 ? {} : { logLevel: config.logLevel },
      ...config.logSink ? { sink: config.logSink } : {}
    });
    const counters = new Counters();
    const handlers = /* @__PURE__ */ new Map();
    const seenIds = new SeenIds();
    const onConnectedListeners = new ListenerSet({
      onError: (error) => logger.warn("onConnected listener threw", { reason: describe(error) })
    });
    const onDisconnectedListeners = new ListenerSet({
      onError: (error) => logger.warn("onDisconnected listener threw", { reason: describe(error) })
    });
    let session = null;
    let connected = false;
    let destroyed = false;
    const send = (envelope) => {
      try {
        win.postMessage(envelope, config.targetOrigin);
      } catch (error) {
        counters.increment(CounterName.DROPPED, "CLONE_FAILED");
        logger.warn("postMessage refused the envelope", {
          channel: config.channel,
          kind: envelope.kind,
          topic: envelope.topic,
          reason: describe(error)
        });
        throw new BridgeError(
          "INVALID_PAYLOAD",
          "The payload could not be transferred to the extension",
          envelope.topic
        );
      }
    };
    const control = (kind, token) => {
      send(
        createEnvelope({
          channel: config.channel,
          kind,
          source: EnvelopeSource.PAGE,
          topic: CONTROL_TOPIC,
          id: nextId(),
          session: token
        })
      );
    };
    const markConnected = (token) => {
      if (connected && session === token) {
        return;
      }
      if (connected && session !== token) {
        markDisconnected("session-replaced");
      }
      session = token;
      seenIds.clear();
      connected = true;
      logger.info("connected", { channel: config.channel });
      onConnectedListeners.emit();
    };
    function markDisconnected(reason) {
      if (!connected) {
        return;
      }
      connected = false;
      session = null;
      logger.info("disconnected", { channel: config.channel, reason });
      onDisconnectedListeners.emit(reason);
    }
    const drop2 = (reason) => {
      counters.increment(CounterName.DROPPED, reason);
    };
    const respond = (request, result) => {
      if (session === null) {
        return;
      }
      send(
        createEnvelope({
          channel: config.channel,
          kind: EnvelopeKind.RESPONSE,
          source: EnvelopeSource.PAGE,
          topic: request.topic,
          id: nextId(),
          correlationId: request.id,
          session,
          ...result.ok ? { ok: true, payload: result.payload } : { ok: false, error: toWireError(result.cause) }
        })
      );
    };
    const serveRequest = async (request) => {
      const entry = handlers.get(request.topic);
      if (!entry) {
        counters.increment(CounterName.REQUEST_FAILED, "NO_HANDLER");
        logger.debug("no handler registered for request", {
          channel: config.channel,
          topic: request.topic,
          id: request.id
        });
        respond(request, { ok: false, cause: new BridgeError("NO_HANDLER", void 0, request.topic) });
        return;
      }
      const payload = asJsonValue(request.payload ?? null);
      if (entry.validate) {
        let valid = false;
        try {
          valid = entry.validate(payload) === true;
        } catch {
          valid = false;
        }
        if (!valid) {
          counters.increment(CounterName.REQUEST_FAILED, "INVALID_PAYLOAD");
          logger.debug("request rejected by handler validate", {
            channel: config.channel,
            topic: request.topic,
            id: request.id
          });
          respond(request, {
            ok: false,
            cause: new BridgeError("INVALID_PAYLOAD", void 0, request.topic)
          });
          return;
        }
      }
      const meta = Object.freeze({
        topic: request.topic,
        messageId: request.id,
        receivedAt: Date.now()
      });
      try {
        const result = await entry.handler(payload, meta);
        assertPayload(result, config.maxPayloadBytes, request.topic);
        counters.increment(CounterName.REQUEST_SERVED, request.topic);
        logger.debug("request served", {
          channel: config.channel,
          topic: request.topic,
          id: request.id
        });
        respond(request, { ok: true, payload: result ?? null });
      } catch (cause) {
        counters.increment(CounterName.REQUEST_FAILED, request.topic);
        logger.warn("request handler threw", {
          channel: config.channel,
          topic: request.topic,
          id: request.id
        });
        respond(request, { ok: false, cause });
      }
    };
    const onMessage = (event) => {
      if (destroyed) {
        return;
      }
      if (event.source !== win) {
        drop2("NOT_SAME_WINDOW");
        return;
      }
      if (typeof event.origin !== "string" || !config.allowedOrigins.has(event.origin)) {
        drop2("ORIGIN_NOT_ALLOWED");
        return;
      }
      const result = validateEnvelope(event.data, {
        channel: config.channel,
        expectedSource: EnvelopeSource.EXTENSION,
        session,
        maxPayloadBytes: config.maxPayloadBytes,
        now: Date.now(),
        allowedKinds: ACCEPTED_KINDS,
        seenIds
      });
      if (!result.ok) {
        drop2(result.reason);
        return;
      }
      const { envelope } = result;
      switch (envelope.kind) {
        case EnvelopeKind.HELLO:
          if (envelope.session.length === 0) {
            drop2("SESSION_MISMATCH");
            return;
          }
          markConnected(envelope.session);
          control(EnvelopeKind.HELLO_ACK, envelope.session);
          break;
        case EnvelopeKind.HELLO_ACK:
          if (envelope.session.length === 0) {
            drop2("SESSION_MISMATCH");
            return;
          }
          markConnected(envelope.session);
          break;
        case EnvelopeKind.REQUEST:
          void serveRequest(envelope);
          break;
        case EnvelopeKind.BYE:
          markDisconnected("peer-left");
          break;
        default:
          drop2("KIND_NOT_ALLOWED");
      }
    };
    const onPageHide = () => {
      if (destroyed || session === null) {
        return;
      }
      control(EnvelopeKind.BYE, session);
      markDisconnected("pagehide");
    };
    win.addEventListener("message", onMessage);
    win.addEventListener("pagehide", onPageHide);
    logger.info("web bridge started", {
      channel: config.channel,
      origin: config.targetOrigin
    });
    control(EnvelopeKind.HELLO, "");
    const bridge = {
      publish(topic, payload) {
        if (destroyed) {
          throw new BridgeError("NOT_CONNECTED", "The bridge has been destroyed");
        }
        assertTopic(topic);
        assertPayload(payload, config.maxPayloadBytes, topic);
        if (!connected || session === null) {
          throw new BridgeError("NOT_CONNECTED", void 0, topic);
        }
        send(
          createEnvelope({
            channel: config.channel,
            kind: EnvelopeKind.PUSH,
            source: EnvelopeSource.PAGE,
            topic,
            id: nextId(),
            session,
            ...payload === void 0 ? {} : { payload }
          })
        );
        counters.increment(CounterName.PUSH_SENT, topic);
        logger.debug("push sent", { channel: config.channel, topic });
      },
      requestHandler(topic, handler, opts = {}) {
        assertTopic(topic);
        if (typeof handler !== "function") {
          throw new BridgeError("INSECURE_CONFIG", "handler must be a function", topic);
        }
        if (handlers.has(topic) && opts.replace !== true) {
          throw new BridgeError(
            "INSECURE_CONFIG",
            `A handler for '${topic}' is already registered. Pass {replace: true} to replace it.`,
            topic
          );
        }
        const entry = { handler };
        if (opts.validate) {
          entry.validate = opts.validate;
        }
        handlers.set(topic, entry);
        logger.debug("request handler registered", { channel: config.channel, topic });
        return () => {
          if (handlers.get(topic) === entry) {
            handlers.delete(topic);
            logger.debug("request handler removed", { channel: config.channel, topic });
          }
        };
      },
      onConnected(listener) {
        const off = onConnectedListeners.add(listener);
        if (connected) {
          try {
            listener();
          } catch (error) {
            logger.warn("onConnected listener threw", { reason: describe(error) });
          }
        }
        return off;
      },
      onDisconnected(listener) {
        return onDisconnectedListeners.add(listener);
      },
      get isConnected() {
        return connected;
      },
      getCounters() {
        return counters.snapshot();
      },
      destroy() {
        if (destroyed) {
          return;
        }
        if (session !== null) {
          control(EnvelopeKind.BYE, session);
        }
        destroyed = true;
        win.removeEventListener("message", onMessage);
        win.removeEventListener("pagehide", onPageHide);
        markDisconnected("destroyed");
        onConnectedListeners.clear();
        onDisconnectedListeners.clear();
        handlers.clear();
        seenIds.clear();
        logger.info("web bridge destroyed", { channel: config.channel });
      }
    };
    return bridge;
  }
  function describe(error) {
    return error instanceof Error ? error.name : typeof error;
  }
  return __toCommonJS(src_exports);
})();

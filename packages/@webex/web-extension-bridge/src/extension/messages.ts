import type {WireError} from '../core/errors';
import type {JsonValue} from '../core/json';
import {readOwn} from '../core/json';
import type {Envelope} from '../core/protocol';
import type {BufferedMessage, Connection, PushMeta} from '../types';

/**
 * Extension-internal IPC, deliberately separate from the wire envelope.
 *
 * The envelope shape is frozen for protocol v1, so transport concerns that only exist
 * inside the extension — which tab, how long to wait, which command a popup issued —
 * live in these wrappers instead of being smuggled into envelope fields.
 */

export const RELAY_MARKER = '__webexBridgeRelay';
export const CLIENT_MARKER = '__webexBridgeClient';

export const RelayKind = {
  CONNECT: 'CONNECT',
  DISCONNECT: 'DISCONNECT',
  PUSH: 'PUSH',
  REQUEST: 'REQUEST',
} as const;

export type RelayKind = (typeof RelayKind)[keyof typeof RelayKind];

/** Content script to service worker. */
export interface RelayToWorker {
  __webexBridgeRelay: true;
  channel: string;
  kind: 'CONNECT' | 'DISCONNECT' | 'PUSH';
  session: string;
  envelope?: Envelope;
  reason?: string;
}

/** Service worker to content script, carrying the caller's timeout for the second timer. */
export interface RelayRequest {
  __webexBridgeRelay: true;
  channel: string;
  kind: 'REQUEST';
  envelope: Envelope;
  timeoutMs: number;
}

export type RelayResult = {ok: true; envelope: Envelope} | {ok: false; error: WireError};

export const ClientCommand = {
  REQUEST: 'request',
  LIST_CONNECTIONS: 'listConnections',
  GET_BUFFERED: 'getBufferedMessages',
  GET_COUNTERS: 'getCounters',
} as const;

export type ClientCommand = (typeof ClientCommand)[keyof typeof ClientCommand];

/** Extension UI page to service worker. */
export interface ClientCommandMessage {
  __webexBridgeClient: true;
  channel: string;
  command: ClientCommand;
  /**
   * The request topic for `REQUEST`, and the buffer filter for `GET_BUFFERED`.
   *
   * `GET_BUFFERED` carries it so the worker can filter before applying `limit`. The
   * client used to send `limit` alone and filter the reply itself, which meant the
   * limit truncated across all topics first and the requested topic came back short.
   */
  topic?: string;
  payload?: JsonValue;
  tabId?: number;
  timeoutMs?: number;
  /** `GET_BUFFERED` only. Applied by the worker *after* `topic`. */
  limit?: number;
}

export type ClientCommandValue =
  | JsonValue
  | Connection[]
  | BufferedMessage[]
  | Record<string, number>;

export type ClientResult = {ok: true; value: ClientCommandValue} | {ok: false; error: WireError};

/** Service worker to extension UI pages, broadcasting a received push. */
export interface ClientPushEvent {
  __webexBridgeClient: true;
  channel: string;
  event: 'push';
  topic: string;
  payload: JsonValue;
  meta: PushMeta;
}

const CLIENT_COMMANDS = new Set<string>(Object.values(ClientCommand));

/**
 * @param value - Untrusted runtime message.
 * @param channel - Channel this side is configured for.
 * @returns The relay message, or `undefined` when the value is not one for us.
 */
export function asRelayToWorker(value: unknown, channel: string): RelayToWorker | undefined {
  if (readOwn(value, RELAY_MARKER) !== true || readOwn(value, 'channel') !== channel) {
    return undefined;
  }

  const kind = readOwn(value, 'kind');

  if (kind !== RelayKind.CONNECT && kind !== RelayKind.DISCONNECT && kind !== RelayKind.PUSH) {
    return undefined;
  }

  if (typeof readOwn(value, 'session') !== 'string') {
    return undefined;
  }

  return value as RelayToWorker;
}

/**
 * @param value - Untrusted runtime message.
 * @param channel - Channel this side is configured for.
 * @returns The relay request, or `undefined` when the value is not one for us.
 */
export function asRelayRequest(value: unknown, channel: string): RelayRequest | undefined {
  if (
    readOwn(value, RELAY_MARKER) !== true ||
    readOwn(value, 'channel') !== channel ||
    readOwn(value, 'kind') !== RelayKind.REQUEST
  ) {
    return undefined;
  }

  const timeoutMs = readOwn(value, 'timeoutMs');

  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs)) {
    return undefined;
  }

  return value as RelayRequest;
}

/**
 * @param value - Untrusted runtime message.
 * @param channel - Channel this side is configured for.
 * @returns The command, or `undefined` when the value is not one for us.
 */
export function asClientCommand(value: unknown, channel: string): ClientCommandMessage | undefined {
  if (readOwn(value, CLIENT_MARKER) !== true || readOwn(value, 'channel') !== channel) {
    return undefined;
  }

  const command = readOwn(value, 'command');

  if (typeof command !== 'string' || !CLIENT_COMMANDS.has(command)) {
    return undefined;
  }

  return value as ClientCommandMessage;
}

/**
 * @param value - Untrusted runtime message.
 * @param channel - Channel this side is configured for.
 * @returns The push event, or `undefined` when the value is not one for us.
 */
export function asClientPushEvent(value: unknown, channel: string): ClientPushEvent | undefined {
  if (
    readOwn(value, CLIENT_MARKER) !== true ||
    readOwn(value, 'channel') !== channel ||
    readOwn(value, 'event') !== 'push'
  ) {
    return undefined;
  }

  if (typeof readOwn(value, 'topic') !== 'string') {
    return undefined;
  }

  return value as ClientPushEvent;
}

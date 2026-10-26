import {ENVELOPE_MARKER, PROTOCOL_VERSION} from './constants';
import type {WireError} from './errors';
import type {JsonValue} from './json';

export const EnvelopeKind = {
  HELLO: 'HELLO',
  HELLO_ACK: 'HELLO_ACK',
  PUSH: 'PUSH',
  REQUEST: 'REQUEST',
  RESPONSE: 'RESPONSE',
  BYE: 'BYE',
} as const;

export type EnvelopeKind = (typeof EnvelopeKind)[keyof typeof EnvelopeKind];

export const ENVELOPE_KINDS: readonly EnvelopeKind[] = [
  EnvelopeKind.HELLO,
  EnvelopeKind.HELLO_ACK,
  EnvelopeKind.PUSH,
  EnvelopeKind.REQUEST,
  EnvelopeKind.RESPONSE,
  EnvelopeKind.BYE,
];

export const EnvelopeSource = {
  PAGE: 'page',
  EXTENSION: 'extension',
} as const;

export type EnvelopeSource = (typeof EnvelopeSource)[keyof typeof EnvelopeSource];

/**
 * The single message shape that crosses every hop. Frozen for protocol v1:
 * additive optional fields need a minor bump, anything else a major bump.
 */
export interface Envelope {
  __webexBridge: true;
  v: number;
  channel: string;
  kind: EnvelopeKind;
  source: EnvelopeSource;
  topic: string;
  id: string;
  correlationId: string | null;
  session: string;
  payload?: JsonValue;
  ok?: boolean;
  error?: WireError;
  ts: number;
}

export interface CreateEnvelopeInput {
  channel: string;
  kind: EnvelopeKind;
  source: EnvelopeSource;
  topic: string;
  id: string;
  session: string;
  correlationId?: string | null;
  payload?: JsonValue;
  ok?: boolean;
  error?: WireError;
  ts?: number;
}

/**
 * Build an envelope on a null prototype, so no field name in the input can reach
 * `Object.prototype` on this side or after a structured clone on the other.
 *
 * @param input - Envelope fields. `ts` defaults to now.
 * @returns A populated envelope.
 */
export function createEnvelope(input: CreateEnvelopeInput): Envelope {
  const envelope = Object.create(null) as Envelope;

  envelope[ENVELOPE_MARKER as '__webexBridge'] = true;
  envelope.v = PROTOCOL_VERSION;
  envelope.channel = input.channel;
  envelope.kind = input.kind;
  envelope.source = input.source;
  envelope.topic = input.topic;
  envelope.id = input.id;
  envelope.correlationId = input.correlationId ?? null;
  envelope.session = input.session;
  envelope.ts = input.ts ?? Date.now();

  if (input.payload !== undefined) {
    envelope.payload = input.payload;
  }

  if (input.ok !== undefined) {
    envelope.ok = input.ok;
  }

  if (input.error !== undefined) {
    envelope.error = input.error;
  }

  return envelope;
}

/**
 * @param source - The source tag of the local side.
 * @returns The source tag the local side accepts from its peer.
 */
export function peerSource(source: EnvelopeSource): EnvelopeSource {
  return source === EnvelopeSource.PAGE ? EnvelopeSource.EXTENSION : EnvelopeSource.PAGE;
}

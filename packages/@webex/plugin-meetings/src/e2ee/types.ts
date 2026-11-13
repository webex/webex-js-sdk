/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type {IdentityCredentials, IdentityTrustAnchors} from '@webex/internal-plugin-identity';
import type LLMChannel from '@webex/internal-plugin-llm';

import {EVENT_TRIGGERS, type Enum} from '../constants';
import type {LocusDTO} from '../locus-info/types';
import type Members from '../members';

/** The Locus DTO fields consumed by E2EE, matching the shape exposed by `Meeting.locusInfo`. */
export type E2eeLocusInfo = Pick<LocusDTO, 'url' | 'info'>;

/** Per-meeting context supplied by Meetings without exposing its Meeting class to E2EE. */
export interface E2eeMeetingContext {
  correlationId: string;
  getLocusInfo(): E2eeLocusInfo | undefined;
  getLlmChannel(): LLMChannel | undefined;
  members: Members;
}

/**
 * SDK-facing E2EE types (camelCase), mapped from the raw WASM boundary shapes in wasm.d.ts.
 */

/** Lifecycle state of a per-meeting MLS session. */
export const E2eeState = {
  Disabled: 'disabled',
  Initializing: 'initializing',
  Joining: 'joining',
  Joined: 'joined',
  Failed: 'failed',
  Evicted: 'evicted',
  Left: 'left',
} as const;

export type E2eeState = Enum<typeof E2eeState>;

/** Event payloads emitted by E2eeController and forwarded through Meeting. */
export interface E2eeControllerEventMap {
  [EVENT_TRIGGERS.MEETING_E2EE_SECURITY_CODE_UPDATED]: {securityCode: string | undefined};
  [EVENT_TRIGGERS.MEETING_E2EE_STATE_CHANGED]: {state: E2eeState};
  [EVENT_TRIGGERS.MEETING_E2EE_MEDIA_SERVICES_CHANGED]: {hasMediaServices: boolean};
  [EVENT_TRIGGERS.MEETING_E2EE_FAILURE]: {
    reason: string;
    errorCode?: number;
    errorMessage?: string;
  };
}

export type E2eeControllerEvent = keyof E2eeControllerEventMap;

/** The meeting's overall E2EE trust state, surfaced to the app for its UI indicator. */
export const TrustState = {
  Calculating: 'calculating',
  Strong: 'strong',
  ZeroTrust: 'zeroTrust',
  AdaptiveStrong: 'adaptiveStrong',
  AdaptiveZeroTrust: 'adaptiveZeroTrust',
} as const;

export type TrustState = Enum<typeof TrustState>;

/** Credential-validation outcome from the MLS roster. Keep ordinals in sync with libe2ee. */
export const E2eeValidationResult = {
  Success: 0,
  PartialSuccess: 1,
  Failure: 2,
  ParseError: 3,
  UnknownIssuer: 4,
  UnknownPublicKey: 5,
  InvalidSignature: 6,
  Expired: 7,
  Inactive: 8,
  Revoked: 9,
  UnsupportedCaType: 10,
  InvalidKeypackageSignature: 11,
  UnsupportedCredentialType: 12,
  MissingDisplayNameExtension: 13,
} as const;

export type E2eeValidationResult = (typeof E2eeValidationResult)[keyof typeof E2eeValidationResult];

/** Identity type attached to the leaf certificate. Keep ordinals in sync with libe2ee. */
export const E2eeIdentityType = {
  WebexAnonymousIdentity: 0,
  WebexMachineIdentity: 1,
  WebexUserIdentity: 2,
  ExternalVerifiedIdentity: 3,
} as const;

export type E2eeIdentityType = (typeof E2eeIdentityType)[keyof typeof E2eeIdentityType];

/** A media-encryption (SFrame) key for a given MLS epoch. */
export interface E2eeKey {
  epoch: number;
  baseKey: Uint8Array;
  index: number;
  indexBits: number;
  canEncrypt: boolean;
}

/** SFrame parameters negotiated for the group, reported on a successful join. */
export interface SframeParams {
  cipherSuite: number;
  epochBits: number;
}

/** Parsed certificate information returned with a roster member. */
export interface E2eeCertificateInfo {
  primaryName: string;
  commonName: string;
  organizationName: string;
  emailAddresses: string[];
  domainNames: string[];
  notBefore: number;
  notAfter: number;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  identityType?: E2eeIdentityType;
  der: Uint8Array;
}

export interface E2eeIdentityResult {
  result: E2eeValidationResult;
  certificateChain: E2eeCertificateInfo[];
  failedCertIndex?: number;
}

/** A member of the MLS roster and its credential-validation result. */
export interface E2eeRosterMember {
  url: string;
  displayName: string;
  deviceType: string;
  validationResult: E2eeValidationResult;
  identityResults?: E2eeIdentityResult[];
}

/** Configuration for initializing an MLS group session. */
export interface MLSConfig {
  participantId: string;
  deviceUrl: string;
  deviceType: string;
  correlationId: string;
  displayName: string;
  serviceUrl: string;
  credentials?: IdentityCredentials;
  trustAnchors?: IdentityTrustAnchors;
  joinTimeout?: number;
  coalesceWindow?: number;
}

/**
 * HTTP transport the MLS engine uses for its protocol requests. Implemented by
 * MediaEncryptionService (which routes to webex.request); injected so the engine stays pure.
 * Bodies are plain JS objects: MLS converts the engine's JSON bytes to/from objects at its boundary.
 */
export interface IMlsHttpClient {
  request(url: string, body: unknown): Promise<unknown>;
}

/** Which signaling channel an incoming MLS protocol event arrived on. */
export const E2eeSignalingSource = {
  Llm: 'llm',
  Mercury: 'mercury',
} as const;

export type E2eeSignalingSource = Enum<typeof E2eeSignalingSource>;

/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type {Enum} from '../constants';

/**
 * SDK-facing E2EE types (camelCase), mapped from the raw WASM boundary shapes in wasm.d.ts.
 */

/** E2EE feature config (a slice of the meetings plugin config). */
export interface E2eeConfig {
  enableE2ee?: boolean;
}

/** Lifecycle state of a per-meeting MLS session. */
export type E2eeState =
  | 'disabled'
  | 'initializing'
  | 'joining'
  | 'joined'
  | 'failed'
  | 'evicted'
  | 'left';

/** The meeting's overall E2EE trust state, surfaced to the app for its UI indicator. */
export type E2eeTrustState =
  | 'Calculating'
  | 'Strong'
  | 'ZeroTrust'
  | 'AdaptiveStrong'
  | 'AdaptiveZeroTrust';

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

/**
 * Identity-validation outcome for an MLS roster member. Mirrors (by ordinal) the C++
 * `RosterStatus::ValidationResult` enum in libe2ee (`common/include/e2ee_common/types.h`) — keep
 * the two in sync. `Success` means the member's identity is verified.
 */
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

export type E2eeValidationResult = Enum<typeof E2eeValidationResult>;

/** A member of the MLS roster. A `validationResult` of `Success` means the member is verified. */
export interface E2eeRosterMember {
  url: string;
  displayName: string;
  deviceType: string;
  validationResult: E2eeValidationResult;
}

/** Per-device E2EE verification result, derived from the MLS roster and applied onto a Member. */
export interface E2eeDeviceVerification {
  deviceUrl: string;
  validationResult: E2eeValidationResult;
  displayName?: string;
  deviceType?: string;
}

/** A member's aggregate E2EE verification state across all of their devices. */
export type E2eeMemberVerificationState =
  | 'unknown'
  | 'verified'
  | 'unverified'
  | 'partiallyVerified';

/** X.509 credentials (private key + certificate chain) used to join the MLS group. */
export interface E2eeCredentials {
  privateKey: Uint8Array;
  certChain: ArrayBuffer[];
}

/** Trust anchors (PEM) used to validate member certificates. */
export interface E2eeTrustAnchors {
  webexCaRoots?: string;
  domainNameRoots?: string;
  userIdentityRoots?: string;
}

/** Configuration for initializing an MLS group session. */
export interface MlsGroupSessionConfig {
  participantId: string;
  deviceUrl: string;
  deviceType?: string;
  correlationId: string;
  displayName: string;
  serviceUrl: string;
  credentials?: E2eeCredentials;
  trustAnchors?: E2eeTrustAnchors;
  joinTimeout?: number;
  coalesceWindow?: number;
}

/**
 * HTTP transport the MLS engine uses for its protocol requests. Implemented by
 * MediaEncryptionService (which routes to webex.request); injected so the engine stays pure.
 */
export interface IMlsHttpClient {
  request(url: string, body: Uint8Array): Promise<Uint8Array>;
}

/** Which signaling channel an incoming MLS protocol event arrived on. */
export type E2eeSignalingSource = 'llm' | 'mercury';

/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import type {IdentityCredentials, IdentityTrustAnchors} from '@webex/internal-plugin-identity';

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

/** Parsed X.509 certificate details from a member's certificate chain. */
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
  identityType?: number;
  der: Uint8Array;
}

export interface E2eeIdentityResult {
  /** Result for this X.509 credential, which may differ from the overall MultiCredential result. */
  result: E2eeValidationResult;
  certificateChain: E2eeCertificateInfo[];
  failedCertIndex?: number;
}

/** A member of the MLS roster and its overall libe2ee credential validation result. */
export interface E2eeRosterMember {
  url: string;
  displayName: string;
  deviceType: string;
  validationResult: E2eeValidationResult;
  identityResults?: E2eeIdentityResult[];
}

/** Per-device E2EE verification result, derived from the MLS roster and applied onto a Member. */
export interface E2eeDeviceVerification {
  deviceUrl: string;
  /** Overall libe2ee result for this device's credential or MultiCredential. */
  validationResult: E2eeValidationResult;
  displayName?: string;
  deviceType?: string;
  identityResults?: E2eeIdentityResult[];
}

/** A member's aggregate E2EE verification state across all of their devices. */
export type E2eeMemberVerificationState =
  | 'unknown'
  | 'verified'
  | 'unverified'
  | 'partiallyVerified';

/** Configuration for initializing an MLS group session. */
export interface MLSConfig {
  participantId: string;
  deviceUrl: string;
  deviceType?: string;
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
 */
export interface IMlsHttpClient {
  request(url: string, body: Uint8Array): Promise<Uint8Array>;
}

/** Which signaling channel an incoming MLS protocol event arrived on. */
export type E2eeSignalingSource = 'llm' | 'mercury';

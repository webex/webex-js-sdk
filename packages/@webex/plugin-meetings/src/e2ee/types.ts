/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * SDK-facing shapes used by the isolated MLS protocol engine. Integration-specific meeting,
 * identity-plugin and signaling types are added by the later adapter phases.
 */

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

/** A media-encryption (SFrame) key for an MLS epoch. */
export interface E2eeKey {
  epoch: number;
  baseKey: Uint8Array;
  index: number;
  indexBits: number;
  canEncrypt: boolean;
}

/** SFrame parameters negotiated for an MLS group. */
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

/** Credentials and trust anchors consumed by the WASM engine. */
export interface MLSConfig {
  participantId: string;
  deviceUrl: string;
  deviceType?: string;
  correlationId: string;
  displayName: string;
  serviceUrl: string;
  credentials?: {privateKey: Uint8Array; certChain: Uint8Array[]};
  trustAnchors?: {
    webexCaRoots?: string;
    domainNameRoots?: string;
    userIdentityRoots?: string;
    domainNameRootsP7b?: Uint8Array;
  };
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

/** Signaling transport that delivered an MLS protocol message. */
export type E2eeSignalingSource = 'llm' | 'mercury';

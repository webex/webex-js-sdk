/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * SDK-facing E2EE types (camelCase), mapped from the raw WASM boundary shapes in wasm.d.ts.
 */

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

/** A member of the MLS roster. `validationResult === 0` means the member is verified. */
export interface E2eeRosterMember {
  url: string;
  displayName: string;
  deviceType: string;
  validationResult: number;
}

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

/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

export interface IdentityCredentials {
  privateKey: Uint8Array;
  certChain: Uint8Array[];
}

export interface IdentityTrustAnchors {
  webexCaRoots?: string;
  domainNameRoots?: string;
  userIdentityRoots?: string;
}

/** Methods exposed by the shared identity plugin to consuming plugins. */
export interface IdentityProvider {
  getCredentials(contactId: string): Promise<IdentityCredentials>;
  getTrustAnchors(): IdentityTrustAnchors;
}

/** Generated certificate signing request and its PKCS#8 private key. */
export interface CertSigningRequest {
  privKeyDer: Uint8Array;
  csr: string;
}

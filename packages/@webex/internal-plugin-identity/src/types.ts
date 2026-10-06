export interface IdentityCredentials {
  privateKey: Uint8Array;
  certChain: ArrayBuffer[];
}

export interface IdentityTrustAnchors {
  webexCaRoots?: string;
  domainNameRoots?: string;
  userIdentityRoots?: string;
}

/** Generated certificate signing request and its PKCS#8 private key. */
export interface CertSigningRequest {
  privKeyDer: Uint8Array;
  csr: string;
}

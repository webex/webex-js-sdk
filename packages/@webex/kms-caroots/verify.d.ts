/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

export interface VerifyUnionBundleOptions {
  /** WebCrypto implementation. Defaults to `globalThis.crypto`. */
  crypto?: Crypto;
  /** Reject bundles whose signed version (YYYYMMDD) is lower. Defaults to 0. */
  minBundleVersion?: number;
  /** Current time, used to reject bundles signed in the future. */
  now?: Date;
  /** Base64 DER trust anchors. Defaults to the pinned TRS Bundle Root CA; tests only. */
  trustAnchors?: string[];
}

export interface VerifiedUnionBundle {
  /** Raw base64-encoded (DER) CA root certificates, in `encryption.caroots` format. */
  caroots: string[];
  bundleName: string;
  /** Signed bundle version, YYYYMMDD. */
  bundleVersion: number;
  signingTime: Date;
}

export type UnionBundleVerificationReason =
  | 'parse'
  | 'attributes'
  | 'signature'
  | 'name'
  | 'version'
  | 'signing-time'
  | 'no-certificates';

export class UnionBundleVerificationError extends Error {
  reason: UnionBundleVerificationReason;
}

/**
 * Verifies a Cisco Trusted Root Store "Union" bundle (`ios_union.p7b`) against
 * the pinned TRS Bundle Root CA and extracts its CA roots. Browser-safe and
 * network-free.
 */
export function verifyUnionBundle(
  bytes: ArrayBuffer | ArrayBufferView,
  options?: VerifyUnionBundleOptions
): Promise<VerifiedUnionBundle>;

/** Base64 DER of the pinned Cisco TRS Bundle Root CA. */
export const TRS_BUNDLE_ROOT_CA: string;

/** The expected signed bundle name, `Trusted Union Bundle`. */
export const UNION_BUNDLE_NAME: string;

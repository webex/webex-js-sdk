/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

export * from './verify';

export interface GenerateKmsCarootsOptions {
  /** Override the Cisco bundle URL. Defaults to the Union bundle. */
  bundleUrl?: string;
  /** Verify a local `ios_union.p7b` file instead of downloading the bundle. */
  input?: string;
  /** Reject bundles whose signed version (YYYYMMDD) is lower. */
  minBundleVersion?: number;
}

/**
 * Loads (downloads or reads) and verifies the Cisco Trusted Root Store "Union"
 * bundle, then decodes it into the `encryption.caroots` format: an array of raw
 * base64-encoded (DER) certificates.
 */
export function generateKmsCaroots(options?: GenerateKmsCarootsOptions): Promise<string[]>;

/** Reads `input` when set, otherwise downloads `bundleUrl` (defaults to the Union bundle). */
export function loadUnionBundle(options?: {bundleUrl?: string; input?: string}): Promise<Uint8Array>;

/** The default Cisco Trusted Root Store "Union" bundle URL. */
export const DEFAULT_BUNDLE_URL: string;

/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

export interface GenerateKmsCarootsOptions {
  /** Override the Cisco bundle URL. Defaults to the Union bundle. */
  bundleUrl?: string;
  /** Override the Mozilla NSS certdata URL. */
  mozillaBundleUrl?: string;
}

/**
 * Downloads, verifies, and decodes the Cisco Trusted Root Store "Union" bundle
 * into the `encryption.caroots` format: an array of raw base64-encoded (DER)
 * certificates. Requires the `openssl` binary on PATH.
 */
export function generateKmsCaroots(options?: GenerateKmsCarootsOptions): Promise<string[]>;

declare const caroots: string[];

export default caroots;

/** The default Cisco Trusted Root Store "Union" bundle URL. */
export const DEFAULT_BUNDLE_URL: string;

/** The default Mozilla NSS certdata URL. */
export const DEFAULT_MOZILLA_BUNDLE_URL: string;

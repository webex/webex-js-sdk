/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

export interface GenerateKmsCarootsOptions {
  /** Override the Cisco bundle URL. Defaults to the Union bundle. */
  bundleUrl?: string;
}

/**
 * Downloads, verifies, and decodes the Cisco Trusted Root Store "Union" bundle
 * into the `encryption.caroots` format: an array of raw base64-encoded (DER)
 * certificates. Requires the `openssl` binary on PATH.
 */
export function generateKmsCaroots(options?: GenerateKmsCarootsOptions): Promise<string[]>;

/** The default Cisco Trusted Root Store "Union" bundle URL. */
export const DEFAULT_BUNDLE_URL: string;

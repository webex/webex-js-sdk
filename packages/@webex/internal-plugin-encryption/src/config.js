/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {UNION_BUNDLE_ASSET} from './union-bundle';

export default {
  encryption: {
    joseOptions: {
      compact: true,
      contentAlg: 'A256GCM',
      protect: '*',
    },

    /**
     * Initial timeout before contacting KMS with a new request
     * @type {Number}
     */
    kmsInitialTimeout: 6000,

    /**
     * Maximum timeout before negotiating a new ECDH key
     * and contacting KMS with a new request
     * @type {Number}
     */
    kmsMaxTimeout: 32000,

    /**
     * Maximum timeout after negotiating several ECDH keys
     * @type {Number}
     */
    ecdhMaxTimeout: 32000 * 3,

    /**
     * Debounce wait before sending a kms request
     * @type {Number}
     */
    batcherWait: 50,

    /**
     * Maximum queue size before sending a kms request
     * @type {Number}
     */
    batcherMaxCalls: 50,

    /**
     * Debounce max wait before sending a kms metric
     * @type {Number}
     */
    batcherMaxWait: 150,

    /**
     * Whether to validate the KMS certificate chain. Defaults to false.
     * Set to true to require the KMS certificate to chain to a trusted CA root
     * (see `caroots` and `carootsAsset`), and when no CA roots are available
     * validation fails closed.
     * @type {boolean}
     */
    shouldValidateKMSCertificate: false,

    /**
     * CA roots used to validate the KMS certificate chain, as an array of raw
     * base64-encoded certificates (the DER body, without the
     * -----BEGIN/END CERTIFICATE----- lines). When set, these take precedence
     * and the `carootsAsset` bundle is never downloaded. Requires
     * `shouldValidateKMSCertificate: true` to enforce validation. Generate them
     * with `@webex/kms-caroots` for offline or locked-down deployments.
     * @type {?string[]}
     */
    caroots: undefined,

    /**
     * File name of Cisco's signed Trusted Root Store "Union" bundle, loaded
     * from `assetsBaseUrl` (from the package's own assets in Node) on first
     * KMS use when validation is enabled and `caroots` isn't set. The bundle's
     * signature is verified before its certificates are trusted.
     * @type {string}
     */
    carootsAsset: UNION_BUNDLE_ASSET,

    /**
     * Base URL of the directory hosting this plugin's static assets (e.g.
     * `ios_union-<version>.p7b`). Defaults to `/assets/internal-plugin-encryption/` on
     * the page's origin; the `webex` package overrides it with the versioned
     * jsDelivr copy of its UMD assets. Self-hosters should point it at their
     * copy of `internal-plugin-encryption/dist/assets/`. Not used in Node,
     * which reads the package's own copy.
     * @type {string}
     */
    assetsBaseUrl: '/assets/internal-plugin-encryption/',

    /**
     * An additional CA root bundle validated alongside `caroots`. Unlike
     * `caroots`, a validation failure against these roots is reported as a
     * metric instead of failing the ECDH negotiation. This allows a new CA
     * root bundle to be trialled in parallel with the enforced `caroots`
     * without risking total failure.
     * @type {?string[]}
     */
    carootsReportOnly: undefined,
  },
};

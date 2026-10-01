/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

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
     * Whether to validate the KMS certificate chain against `caroots`. Defaults
     * to true as a secure default: when enabled the KMS certificate must
     * validate against a configured `caroots` bundle, and a missing bundle
     * fails closed. Set to false to temporarily opt out of validation, e.g.
     * while upgrading and wiring up the CA root bundle.
     * @type {boolean}
     */
    shouldValidateKMSCertificate: true,

    /**
     * CA root bundle used to validate the KMS certificate chain, as an array of
     * raw base64-encoded certificates (the DER body, without the
     * -----BEGIN/END CERTIFICATE----- lines). Required when
     * `shouldValidateKMSCertificate` is true.
     *
     * Supplied by the consuming application at build/config time; the SDK does
     * not ship a bundle and does no file/network I/O to obtain one. Cisco
     * first-party clients should source these roots from the Cisco Trusted Root
     * Store Union bundle. See the plugin README, tooling/generate-kms-caroots.js,
     * and https://www.cisco.com/security/pki/trs/readme.html for details.
     * @type {?string[]}
     */
    caroots: undefined,

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

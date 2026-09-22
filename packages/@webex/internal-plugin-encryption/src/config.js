/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Reads a base64-encoded CA root bundle (JSON array) from the
 * `WEBEX_KMS_CAROOTS` environment variable, if present. This lets consuming
 * apps and CI supply roots without baking them into the package. See
 * tooling/generate-kms-caroots.js and the plugin README.
 * @returns {Array} the parsed CA roots, or undefined when the variable is unset
 */
const getCarootsFromEnv = () => {
  const raw = process.env.WEBEX_KMS_CAROOTS;

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return undefined;
  }
};

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
     * Supplied by the consuming application; the SDK does not ship a bundle.
     * Defaults to the `WEBEX_KMS_CAROOTS` environment variable when set (see
     * tooling/generate-kms-caroots.js). Cisco first-party clients should source
     * these roots from the Cisco Trusted Root Store Union bundle. See the plugin
     * README and https://www.cisco.com/security/pki/trs/readme.html for details.
     * @type {?string[]}
     */
    caroots: getCarootsFromEnv(),

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

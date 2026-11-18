/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

// Browser-safe, network-free verifier for the Cisco Trusted Root Store "Union"
// bundle (ios_union.p7b). Shared by the SDK runtime, the CLI and the asset
// refresh script so every consumer verifies the bundle the same way.

const {fromBER} = require('asn1js');
const {Certificate, ContentInfo, CryptoEngine, SignedData} = require('pkijs');

const OID_PKCS7_DATA = '1.2.840.113549.1.7.1';
const OID_PKCS7_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const OID_BUNDLE_VERSION = '1.3.6.1.4.1.9.21.2.3.1';
const OID_BUNDLE_NAME = '1.3.6.1.4.1.9.21.2.3.2';

const UNION_BUNDLE_NAME = 'Trusted Union Bundle';

// The bundle holds a few hundred certificates, which exceeds asn1js' default
// node limit. Keep explicit bounds so a hostile input can't exhaust memory.
const MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
const MAX_ASN1_NODES = 200000;

// Tolerate client clocks that are slightly behind the bundle signer's clock.
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * Cisco "TRS Bundle Root CA" (O=Cisco, CN=TRS Bundle Root CA, valid until
 * 2099-11-29), from https://www.cisco.com/security/pki/certs/tbrca.pem.
 * SHA-256 fingerprint:
 * DE:C6:69:E3:22:E0:7C:D7:C6:0A:56:90:4B:F5:0C:29:FA:1E:75:07:17:23:FC:10:35:77:E2:7B:22:69:68:D5
 * This is the only certificate trusted to anchor the bundle signature.
 */
const TRS_BUNDLE_ROOT_CA =
  'MIIFITCCAwmgAwIBAgIJCx2DmXaxNaahMA0GCSqGSIb3DQEBDQUAMC0xDjAMBgNVBAoTBUNpc2NvMRswGQYDVQQDExJUUlMgQnVuZGxlIFJvb3QgQ0EwIBcNMjMxMTI5MTcxMTUwWhgPMjA5OTExMjkxNzExNTBaMC0xDjAMBgNVBAoTBUNpc2NvMRswGQYDVQQDExJUUlMgQnVuZGxlIFJvb3QgQ0EwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC8dX+aFnzXOHEl6K+CL8X7Bz099Eor4oie27n+C9zkSz5R5IFlWuyqS38e5qmGTTGyqxQG+mXwBSnpR2kyGV9qh/e1nloneAgPu9YbgXgzgzN3+4bxzy2lstmYslGzm63dcttb5mHqfZra3+jd5X+wU02fNAB1U6HNsvbL6aWRi08jf8L9yyGVfLyaCp99rShpSCxi3wqVcmAo/xPQD+Ih5iAYNCnKPm1X3QnP8JbhSbW6fBnO0Q3FxcR9GGY/Ro16j6xvMSL2JxstDsGMKZVNexQFD+npOgK4rx3aR+aPe9mPmHSBODLruY/NGsuqLMLwffnKbjuX03CESFZ6GPCbRGE3M+/fGS4eejkQUY+NyF3SZVl5wBUEKf+wsOLGnDARNT/iMt6MMtcOuZo6OPLRXhvuyEHPxyCSm3j6EAD2sDCJjf0r9OTk/xsyQtJyArCfiwsUd+Ndn538tvEzq0XxLeoPfxSqskQBIH01hK5dm+AYY3Y8yGVZc33qhz89qzzR4Gfllt89+vNlAJEuMNZa4wgVc1XLiig1ScwNG0o3Pz/SqerU8SBBeVXPrOqoFLwk1BowV+Z/Qbj3FdGGukLoY19opGtTUTvs1q35zqC/v7Y1hKY6YzjuwFvG2yPyS+fiuBH/SKRz+8b5DaOdAbVdBv6CxCuARJPJ+DstPnNq2QIDAQABo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUc1L8QT5ciEptfJRmvv8e5xmVyM4wDQYJKoZIhvcNAQENBQADggIBALldAUUkTolfh8eFDvqb1ea9VAsobnQ7pPPmzjK3K/Au5VY0LF1842fFjjTMGfx2FCaFCEk8k8DfGuzf1RO3x67njP7XOIn6dwgvnkF7GYJ6raWnbFFNlIgNc8DGFZo9d+HFnaMrrgzAVbJFqESbNfTYZw0N9yXz8Subq7tDGXpSI8QH9dbXFMx+u5pI4rIGg/5WtMMJpqKRKaZVqs9tmnEYSG4Wdd/FrV2ZAO7rkN5FMqij7ZE9yfhusFdLVEMxzqdG7QtKHLR+kurjRJbgGC/I2V+ypAbCbITobc+/AWRSrMJdsBnVif1oiR/87jxT49uMXtX/3Kp2RZ0SOpEGiNpOutYhbUWIuFBMByusmnIpKr81LM7sX9v/kr3CNfuIHGkG+CVfMw/4eGj5VHE2KlcPJBbXdwhLGOk/+z8LhyhiPkBiw6f6QDhy+jZVuBwOTQayk+o8HR8ySLIKEzYVogLuBF03qGRd+qI8speMWEHmCLbn/Vmt/NlxrWlsGBVz3/pPEsUiCyWbms9aFaVy6w0sGqXelFnfrkOn4kenc3t6YyugpM3lXaOqwQsxNeKVcN9D2kqlvN6n8CQMUnOagWUakeVq4T2wGe1R8WESUn7gAcJ5EnrP7y3Y6QAInzzGGYT9JbyF3t43YYuZDCsm6MOVM3do5DpJMUz/+06WhNi/';

/**
 * Error thrown when a bundle fails verification. `reason` is a stable,
 * machine-readable code suitable for metrics.
 */
class UnionBundleVerificationError extends Error {
  /**
   * @param {string} reason
   * @param {string} message
   */
  constructor(reason, message) {
    super(`Cisco Union bundle verification failed (${reason}): ${message}`);
    this.name = 'UnionBundleVerificationError';
    this.reason = reason;
  }
}

/**
 * @param {string} reason
 * @param {string} message
 * @returns {never}
 */
function fail(reason, message) {
  throw new UnionBundleVerificationError(reason, message);
}

/**
 * Decode base64 without relying on Node's Buffer.
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Encode bytes as base64 without relying on Node's Buffer.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
  let binary = '';

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

/**
 * @param {ArrayBuffer|ArrayBufferView} bytes
 * @returns {Uint8Array}
 */
function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }
  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  return fail('parse', 'bundle must be an ArrayBuffer or a typed array');
}

/**
 * Parse DER into an asn1js tree with explicit resource limits.
 * @param {Uint8Array} bytes
 * @returns {Object}
 */
function parseAsn1(bytes) {
  const asn1 = fromBER(bytes, {maxNodes: MAX_ASN1_NODES});

  if (asn1.offset === -1) {
    fail('parse', asn1.result.error || 'invalid ASN.1');
  }

  return asn1.result;
}

/**
 * Parse a PKCS#7 ContentInfo that must wrap SignedData.
 * @param {Uint8Array} bytes
 * @returns {{signedData: SignedData, schema: Object}}
 */
function parseSignedData(bytes) {
  let contentInfo;
  let signedData;

  try {
    contentInfo = new ContentInfo({schema: parseAsn1(bytes)});
  } catch (error) {
    if (error instanceof UnionBundleVerificationError) {
      throw error;
    }
    fail('parse', `not a PKCS#7 ContentInfo: ${error.message}`);
  }

  if (contentInfo.contentType !== OID_PKCS7_SIGNED_DATA) {
    fail('parse', `unexpected content type ${contentInfo.contentType}`);
  }

  try {
    signedData = new SignedData({schema: contentInfo.content});
  } catch (error) {
    fail('parse', `not a PKCS#7 SignedData: ${error.message}`);
  }

  return {signedData, schema: contentInfo.content};
}

/**
 * Find a single-valued signed attribute.
 * @param {Object} signerInfo
 * @param {string} oid
 * @returns {Object|undefined}
 */
function getSignedAttribute(signerInfo, oid) {
  const attribute = signerInfo.signedAttrs.attributes.find(({type}) => type === oid);

  if (!attribute) {
    return undefined;
  }
  if (attribute.values.length !== 1) {
    fail('attributes', `signed attribute ${oid} must have exactly one value`);
  }

  return attribute.values[0];
}

/**
 * Read a string-valued attribute (e.g. PrintableString / UTF8String).
 * @param {Object} signerInfo
 * @param {string} oid
 * @param {string} label
 * @returns {string}
 */
function getStringAttribute(signerInfo, oid, label) {
  const value = getSignedAttribute(signerInfo, oid);

  if (!value || typeof value.valueBlock.value !== 'string') {
    fail('attributes', `missing ${label} signed attribute`);
  }

  return value.valueBlock.value;
}

/**
 * Extract the raw DER of every certificate in a certs-only SignedData, in
 * order and without duplicates. The original encoding is kept (not
 * re-serialized) so the roots are byte-identical to the signed content.
 * @param {Object} signedDataSchema asn1js SEQUENCE of the SignedData
 * @returns {string[]} base64 DER certificates
 */
function extractCertificates(signedDataSchema) {
  const certificatesSet = signedDataSchema.valueBlock.value.find(
    ({idBlock}) => idBlock.tagClass === 3 && idBlock.tagNumber === 0
  );

  if (!certificatesSet) {
    fail('no-certificates', 'bundle content contains no certificates');
  }

  const seen = new Set();
  const caroots = [];

  certificatesSet.valueBlock.value.forEach((node) => {
    // Skip anything that is not a plain X.509 certificate (universal SEQUENCE).
    if (node.idBlock.tagClass !== 1 || node.idBlock.tagNumber !== 16) {
      return;
    }

    try {
      // eslint-disable-next-line no-new
      new Certificate({schema: node});
    } catch (error) {
      fail('no-certificates', `bundle content contains an invalid certificate: ${error.message}`);
    }

    const base64 = bytesToBase64(new Uint8Array(node.valueBeforeDecodeView));

    if (!seen.has(base64)) {
      seen.add(base64);
      caroots.push(base64);
    }
  });

  if (caroots.length === 0) {
    fail('no-certificates', 'bundle content contains no certificates');
  }

  return caroots;
}

/**
 * Parse a YYYYMMDD bundle version into a UTC date.
 * @param {string} version
 * @returns {?Date} undefined when malformed or not a real calendar date
 */
function parseVersionDate(version) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(version);

  if (!match) {
    return undefined;
  }

  const [year, month, day] = match.slice(1).map((part) => parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  // Reject values like 20261340 that Date.UTC would silently roll over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

/**
 * Resolve the WebCrypto implementation to use.
 * @param {Crypto} [crypto]
 * @returns {CryptoEngine}
 */
function getEngine(crypto) {
  const webcrypto = crypto || (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);

  if (!webcrypto || !webcrypto.subtle) {
    throw new Error('verifyUnionBundle requires a WebCrypto implementation (options.crypto)');
  }

  return new CryptoEngine({name: 'webex-kms-caroots', crypto: webcrypto, subtle: webcrypto.subtle});
}

/**
 * Verify a Cisco Trusted Root Store "Union" bundle (`ios_union.p7b`) and
 * extract its CA roots.
 *
 * The CMS signature must chain to the pinned TRS Bundle Root CA. The chain is
 * validated at the bundle's signed `signingTime` (the signing certificate is
 * short-lived, so validating against "now" would make every shipped bundle
 * expire after a year); staleness is the caller's concern.
 *
 * @param {ArrayBuffer|ArrayBufferView} bytes DER-encoded bundle
 * @param {Object} [options]
 * @param {Crypto} [options.crypto] WebCrypto implementation; defaults to
 *   `globalThis.crypto`
 * @param {number} [options.minBundleVersion=0] reject bundles whose signed
 *   version (YYYYMMDD) is lower, as rollback protection
 * @param {Date} [options.now=new Date()] current time, used to reject bundles
 *   signed in the future
 * @param {string[]} [options.trustAnchors] base64 DER trust anchors. Defaults
 *   to the pinned TRS Bundle Root CA; only override in tests.
 * @returns {Promise<{caroots: string[], bundleName: string, bundleVersion: number, signingTime: Date}>}
 * @throws {UnionBundleVerificationError}
 */
async function verifyUnionBundle(bytes, options = {}) {
  const {
    crypto,
    minBundleVersion = 0,
    now = new Date(),
    trustAnchors = [TRS_BUNDLE_ROOT_CA],
  } = options;
  const engine = getEngine(crypto);
  const input = toUint8Array(bytes);

  if (input.byteLength > MAX_BUNDLE_BYTES) {
    fail('parse', `bundle is larger than ${MAX_BUNDLE_BYTES} bytes`);
  }

  const {signedData} = parseSignedData(input);

  if (signedData.signerInfos.length !== 1) {
    fail('signature', `expected exactly one signer, found ${signedData.signerInfos.length}`);
  }

  // Also keeps pkijs off its TSTInfo path, which would replace checkDate.
  if (
    signedData.encapContentInfo.eContentType !== OID_PKCS7_DATA ||
    !signedData.encapContentInfo.eContent
  ) {
    fail('parse', 'bundle does not contain embedded pkcs7-data content');
  }

  const [signerInfo] = signedData.signerInfos;

  if (!signerInfo.signedAttrs) {
    fail('attributes', 'bundle signature has no signed attributes');
  }

  const signingTimeValue = getSignedAttribute(signerInfo, OID_SIGNING_TIME);

  if (!signingTimeValue || typeof signingTimeValue.toDate !== 'function') {
    fail('attributes', 'missing signingTime signed attribute');
  }

  const signingTime = signingTimeValue.toDate();

  let result;

  try {
    result = await signedData.verify(
      {
        signer: 0,
        checkChain: true,
        checkDate: signingTime,
        trustedCerts: trustAnchors.map((anchor) => Certificate.fromBER(base64ToBytes(anchor))),
        extendedMode: true,
      },
      engine
    );
  } catch (error) {
    fail('signature', error.message || String(error));
  }

  if (!result || !result.signatureVerified) {
    fail('signature', 'signature does not match the bundle content');
  }

  // Only trust the signed attributes once the signature has been verified.
  const bundleName = getStringAttribute(signerInfo, OID_BUNDLE_NAME, 'bundle name');

  if (bundleName !== UNION_BUNDLE_NAME) {
    fail('name', `unexpected bundle name "${bundleName}"`);
  }

  const versionString = getStringAttribute(signerInfo, OID_BUNDLE_VERSION, 'bundle version');
  const versionDate = parseVersionDate(versionString);

  if (!versionDate) {
    fail('version', `malformed bundle version "${versionString}"`);
  }

  const bundleVersion = parseInt(versionString, 10);

  if (bundleVersion < minBundleVersion) {
    fail('version', `bundle version ${bundleVersion} is older than ${minBundleVersion}`);
  }

  // The chain is checked at the signer-chosen signingTime, so tie the version
  // (YYYYMMDD) to it: a bundle can't claim a version dated after it was signed.
  // With the minBundleVersion check this keeps signingTime on or after the
  // minimum version's date, so retired signing keys can't backdate a bundle
  // into their validity window and claim a newer version.
  if (versionDate.getTime() > signingTime.getTime() + MAX_CLOCK_SKEW_MS) {
    fail(
      'version',
      `bundle version ${bundleVersion} is dated after its signingTime ${signingTime.toISOString()}`
    );
  }

  if (signingTime.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
    fail('signing-time', `bundle signingTime ${signingTime.toISOString()} is in the future`);
  }

  const {schema: innerSchema} = parseSignedData(
    new Uint8Array(signedData.encapContentInfo.eContent.getValue())
  );

  return {
    caroots: extractCertificates(innerSchema),
    bundleName,
    bundleVersion,
    signingTime,
  };
}

module.exports = {
  verifyUnionBundle,
  UnionBundleVerificationError,
  TRS_BUNDLE_ROOT_CA,
  UNION_BUNDLE_NAME,
};

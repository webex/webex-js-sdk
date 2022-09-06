import {parse as parseUrl} from 'url';

import {isUri} from 'valid-url';
import {fromBER} from 'asn1js';
import {
  Certificate,
  RSAPublicKey,
  CertificateChainValidationEngine,
  CryptoEngine,
  setEngine
} from 'pkijs';
import {isArray} from 'lodash';
import jose from 'node-jose';
import crypto from 'isomorphic-webcrypto';
import {Buffer} from 'safe-buffer';

setEngine(
  'newEngine',
  crypto,
  new CryptoEngine({
    name: '',
    crypto,
    subtle: crypto.subtle
  })
);

const VALID_KTY = 'RSA';
const VALID_KID_PROTOCOL = 'kms:';

const X509_COMMON_NAME_KEY = '2.5.4.3';

const X509_SUBJECT_ALT_NAME_KEY = '2.5.29.17';

/**
 * Customize Error so the SDK knows to quit retrying and notify
 * the user
 */
export class KMSError extends Error {
  /**
   * add kmsError field to notify
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.kmsError = true;
  }
}

const throwError = (err) => {
  throw new KMSError(`INVALID KMS: ${err}`);
};

/**
 * Converts the PEM string to a pkijs certificate object
 * @param {string} pem PEM representation of a certificate
 * @returns {Certificate} pkijs object of the certificate
 */
const decodeCert = (pem) => {
  if (typeof pem !== 'string') {
    throwError('certificate needs to be a string');
  }

  const der = Buffer.from(pem, 'base64');
  const ber = new Uint8Array(der).buffer;

  const asn1 = fromBER(ber);

  return new Certificate({schema: asn1.result});
};

/**
 * Validate the 'kty' property of the KMS credentials
 * @param {Object} JWT KMS credentials
 * @param {string} JWT.kty type of certificate
 * @throws {KMSError} if kty is not a valid type
 * @returns {void}
 */
const validateKtyHeader = ({kty}) => {
  if (kty !== VALID_KTY) {
    throwError(`'kty' header must be '${VALID_KTY}'`);
  }
};

const validateKidHeader = ({kid}) => {
  if (!isUri(kid)) {
    throwError('\'kid\' is not a valid URI');
  }

  if (parseUrl(kid).protocol !== VALID_KID_PROTOCOL) {
    throwError(`'kid' protocol must be '${VALID_KID_PROTOCOL}'`);
  }
};

/**
 * Checks the first certificate matches the 'kid' in the JWT.
 * It first checks the Subject Alternative Name then it checks
 * the Common Name
 * @param {Certificate} certificate represents the KMS
 * @param {Object} JWT KMS credentials
 * @param {string} JWT.kid the uri of the KMS
 * @throws {KMSError} if unable to validate certificate against KMS credentials
 * @returns {void}
 */
const validateCommonName = ([certificate], {kid}) => {
  const kidHostname = parseUrl(kid).hostname;
  let validationSuccessful = false;

  if (certificate.extensions) {
    // Subject Alt Names are in here
    for (const extension of certificate.extensions) {
      if (extension.extnID === X509_SUBJECT_ALT_NAME_KEY) {
        const {altNames} = extension.parsedValue;

        for (const entry of altNames) {
          const san = entry.value;

          validationSuccessful = san === kidHostname;
          if (validationSuccessful) {
            break;
          }
        }

        if (validationSuccessful) {
          break;
        }
      }
    }
  }

  if (!validationSuccessful) {
    // Didn't match kid in the Subject Alt Names, checking the Common Name
    const subjectAttributes = certificate.subject.typesAndValues;

    for (const attribute of subjectAttributes) {
      if (attribute.type === X509_COMMON_NAME_KEY) {
        const commonName = attribute.value.valueBlock.value;

        validationSuccessful = commonName === kidHostname;
        if (validationSuccessful) {
          break;
        }
      }
    }
  }

  if (!validationSuccessful) {
    throwError('hostname of the 1st certificate does not match \'kid\'');
  }
};

/**
 * Validate the first KMS certificate against the information
 * provided in the JWT
 * @param {Certificate} certificate first certificate the identifies the KMS
 * @param {Object} JWT credentials of the KMS
 * @param {string} JWT.e Public exponent of the first certificate
 * @param {string} KWT.n Modulus of the first certificate
 * @throws {KMSError} if e or n doesn't match the first certificate
 * @returns {void}
 */
const validatePublicCertificate =
  ([certificate], {e: publicExponent, n: modulus}) => {
    const {encode} = jose.util.base64url;

    const publicKey = certificate.subjectPublicKeyInfo.subjectPublicKey;
    const asn1PublicCert = fromBER(publicKey.valueBlock.valueHex);
    const publicCert = new RSAPublicKey({schema: asn1PublicCert.result});
    const publicExponentHex = publicCert.publicExponent.valueBlock.valueHex;
    const modulusHex = publicCert.modulus.valueBlock.valueHex;

    if (publicExponent !== encode(publicExponentHex)) {
      throwError('Public exponent is invalid');
    }
    if (modulus !== encode(modulusHex)) {
      throwError('Modulus is invalid');
    }
  };

/**
 * Validates the list of certificates against the CAs provided
 * @param {certificate[]} certificates list of certificates provided
 *   by the KMS to certify itself
 * @param {string[]} [caroots=[]] list of Certificate Authorities used to
 *   validate the KMS's certificates
 * @returns {Promise} rejects if unable to validate the certificates
 */
const validateCertificatesSignature = (certificates, caroots = []) => {
  const certificateEngine = new CertificateChainValidationEngine({
    trustedCerts: caroots.map(decodeCert),
    certs: certificates
  });

  return certificateEngine.verify()
    .then(({result, resultCode, resultMessage}) => {
      if (!result) {
        throwError(
          `Certificate Validation failed [${resultCode}]: ${resultMessage}`
        );
      }
    });
};

/**
 * Validates the information provided by the KMS. This is a curried function.
 * The first function takes the caroots param and returns a second function.
 * The second function takes the credentials of the KMS and validates it
 * @param {string[]} caroots PEM encoded certificates that will be used
 *   as Certificate Authorities
 * @param {Object} jwt Object containing the fields necessary to
 *   validate the KMS
 * @returns {Promise} when resolved will return the jwt
 */
const validateKMS = (caroots) => (jwt = {}) => Promise.resolve()
  .then(() => {
    validateKtyHeader(jwt);
    validateKidHeader(jwt);

    if (!(isArray(jwt.x5c) && jwt.x5c.length > 0)) {
      throwError('JWK does not contain a list of certificates');
    }
    const certificates = jwt.x5c.map(decodeCert);

    validateCommonName(certificates, jwt);
    validatePublicCertificate(certificates, jwt);

    // Skip validating signatures if no CA roots were provided
    const promise = caroots ?
      validateCertificatesSignature(certificates, caroots) : Promise.resolve();

    return promise
      .then(() => jwt);
  });

export default validateKMS;

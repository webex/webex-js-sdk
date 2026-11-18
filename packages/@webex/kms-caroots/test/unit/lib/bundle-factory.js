/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

// Builds Union-style bundles signed by a throwaway CA so the verifier's
// negative paths can be exercised without Cisco's private key.

const asn1js = require('asn1js');
const pkijs = require('pkijs');

const OID_DATA = '1.2.840.113549.1.7.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';

const RSA_ALGORITHM = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const DAY = 24 * 60 * 60 * 1000;

const getEngine = () =>
  new pkijs.CryptoEngine({
    name: 'test',
    crypto: globalThis.crypto,
    subtle: globalThis.crypto.subtle,
  });

const bytesToBase64 = (bytes) => {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const name = (commonName) =>
  new pkijs.RelativeDistinguishedNames({
    typesAndValues: [
      new pkijs.AttributeTypeAndValue({
        type: '2.5.4.3',
        value: new asn1js.PrintableString({value: commonName}),
      }),
    ],
  });

let serial = 1;

/**
 * Create a certificate for `keys`, signed by `issuer` (self-signed when omitted).
 */
async function createCertificate({commonName, keys, issuer, isCA, notBefore, notAfter}) {
  const engine = getEngine();
  const certificate = new pkijs.Certificate();

  serial += 1;
  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({value: serial});
  certificate.subject = name(commonName);
  certificate.issuer = issuer ? issuer.certificate.subject : name(commonName);
  certificate.notBefore.value = notBefore;
  certificate.notAfter.value = notAfter;
  certificate.extensions = [
    new pkijs.Extension({
      extnID: '2.5.29.19',
      critical: true,
      extnValue: new pkijs.BasicConstraints({cA: isCA}).toSchema().toBER(false),
    }),
  ];

  await certificate.subjectPublicKeyInfo.importKey(keys.publicKey, engine);
  await certificate.sign(issuer ? issuer.keys.privateKey : keys.privateKey, 'SHA-256', engine);

  return certificate;
}

/**
 * Create a throwaway root CA and a signing certificate issued by it.
 * @param {Object} [options]
 * @param {Date} [options.signerNotBefore]
 * @param {Date} [options.signerNotAfter]
 */
async function createSigningChain({
  signerNotBefore = new Date(Date.now() - DAY),
  signerNotAfter = new Date(Date.now() + 365 * DAY),
} = {}) {
  const {subtle} = globalThis.crypto;
  const rootKeys = await subtle.generateKey(RSA_ALGORITHM, true, ['sign', 'verify']);
  const signerKeys = await subtle.generateKey(RSA_ALGORITHM, true, ['sign', 'verify']);
  const rootCertificate = await createCertificate({
    commonName: 'Forged TRS Bundle Root CA',
    keys: rootKeys,
    isCA: true,
    notBefore: new Date(Date.now() - 10 * 365 * DAY),
    notAfter: new Date(Date.now() + 10 * 365 * DAY),
  });
  const root = {certificate: rootCertificate, keys: rootKeys};
  const signerCertificate = await createCertificate({
    commonName: 'Forged TRS Signing Cert',
    keys: signerKeys,
    issuer: root,
    isCA: false,
    notBefore: signerNotBefore,
    notAfter: signerNotAfter,
  });

  return {
    root,
    signer: {certificate: signerCertificate, keys: signerKeys},
    rootBase64: bytesToBase64(new Uint8Array(rootCertificate.toSchema(true).toBER(false))),
  };
}

/**
 * Wrap certificates in a certs-only PKCS#7 SignedData.
 */
function createCertsOnly(certificates) {
  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({eContentType: OID_DATA}),
    certificates,
    signerInfos: [],
  });

  return new pkijs.ContentInfo({contentType: OID_SIGNED_DATA, content: signedData.toSchema(true)})
    .toSchema()
    .toBER(false);
}

/**
 * Create a signed Union-style bundle.
 * @param {Object} chain result of createSigningChain()
 * @param {Object} [options]
 * @param {string} [options.bundleName]
 * @param {string} [options.bundleVersion]
 * @param {Date} [options.signingTime]
 * @param {Object[]} [options.contentCertificates] pkijs certificates to embed
 * @returns {Promise<Uint8Array>}
 */
async function createBundle(
  chain,
  {
    bundleName = 'Trusted Union Bundle',
    bundleVersion = '20261022',
    signingTime = new Date(),
    contentCertificates = [chain.root.certificate],
  } = {}
) {
  const engine = getEngine();
  const content = createCertsOnly(contentCertificates);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', content);
  const {certificate: signerCertificate, keys} = chain.signer;

  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: OID_DATA,
      eContent: new asn1js.OctetString({valueHex: content}),
    }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: signerCertificate.issuer,
          serialNumber: signerCertificate.serialNumber,
        }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({
          type: 0,
          attributes: [
            new pkijs.Attribute({
              type: '1.2.840.113549.1.9.3',
              values: [new asn1js.ObjectIdentifier({value: OID_DATA})],
            }),
            new pkijs.Attribute({
              type: '1.3.6.1.4.1.9.21.2.3.1',
              values: [new asn1js.PrintableString({value: bundleVersion})],
            }),
            new pkijs.Attribute({
              type: '1.2.840.113549.1.9.5',
              values: [new asn1js.UTCTime({valueDate: signingTime})],
            }),
            new pkijs.Attribute({
              type: '1.3.6.1.4.1.9.21.2.3.2',
              values: [new asn1js.PrintableString({value: bundleName})],
            }),
            new pkijs.Attribute({
              type: '1.2.840.113549.1.9.4',
              values: [new asn1js.OctetString({valueHex: digest})],
            }),
          ],
        }),
      }),
    ],
    // Ship the forged self-signed root in the bundle, as Cisco does, to prove
    // embedded certificates are never treated as trust anchors.
    certificates: [signerCertificate, chain.root.certificate],
  });

  await signedData.sign(keys.privateKey, 0, 'SHA-256', undefined, engine);

  return new Uint8Array(
    new pkijs.ContentInfo({contentType: OID_SIGNED_DATA, content: signedData.toSchema(true)})
      .toSchema()
      .toBER(false)
  );
}

module.exports = {createSigningChain, createBundle, DAY};

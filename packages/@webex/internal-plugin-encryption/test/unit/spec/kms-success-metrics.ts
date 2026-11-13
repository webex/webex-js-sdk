/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import fs from 'fs';
import path from 'path';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Encryption from '@webex/internal-plugin-encryption';
import kmsCaroots from '@webex/kms-caroots';
import jose from 'node-jose';
import sinon from 'sinon';

import {UNION_BUNDLE_ASSET} from '../../../dist/union-bundle';
import {caroots, invalidKey, unrelatedCaroots, validKey} from '../../fixtures/kms-certificate';

describe('paired KMS success metrics', () => {
  const DOWNLOAD = 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_SUCCESS';
  const VERIFIED = 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_SUCCESS';
  const CERTIFICATE = 'JS_SDK_KMS_CERTIFICATE_VALIDATION_SUCCESS';
  const DOWNLOAD_FAILED = 'JS_SDK_KMS_CAROOTS_ASSET_DOWNLOAD_FAILED';
  const VERIFICATION_FAILED = 'JS_SDK_KMS_CAROOTS_ASSET_VERIFICATION_FAILED';
  const CERTIFICATE_FAILED = 'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED';
  const bundle = new Uint8Array(
    fs.readFileSync(path.join(__dirname, '../../../../test-helper-server/static/ios_union.p7b'))
  );
  const assetSuccess = (name: string, reportOnly = false, asset = UNION_BUNDLE_ASSET) => [
    name,
    {
      fields: {success: true},
      tags: {validationMode: reportOnly ? 'report-only' : 'enforced', carootsAsset: asset},
    },
  ];
  const certificateSuccess = (reportOnly = false) => [
    CERTIFICATE,
    {
      fields: {success: true},
      tags: {
        validationMode: reportOnly ? 'report-only' : 'enforced',
        signatureValidation: 'enabled',
      },
    },
  ];
  let webex: any;
  let kms: any;
  let metric: sinon.SinonStub;
  let enforcedBytes: sinon.SinonStub;
  let reportOnlyBytes: sinon.SinonStub;

  beforeEach(() => {
    sinon.useFakeTimers({now: new Date('2026-10-23T04:41:57.000Z'), toFake: ['Date']});
    webex = new MockWebex({children: {encryption: Encryption}});
    metric = sinon.stub().resolves();
    webex.internal.metrics = {submitClientMetrics: metric};
    kms = webex.internal.encryption.kms;
    Object.assign(kms.config, {
      shouldValidateKMSCertificate: true,
      caroots: undefined,
      carootsReportOnly: undefined,
      carootsAsset: UNION_BUNDLE_ASSET,
      assetsBaseUrl: 'https://enforced.example.com/roots/',
      reportOnlyAssetsBaseUrl: undefined,
    });
    enforcedBytes = sinon.stub(kms, '_getCarootsAssetBytes').resolves(bundle.slice());
    reportOnlyBytes = sinon.stub(kms, '_getReportOnlyCarootsAssetBytes').resolves(bundle.slice());
  });

  afterEach(() => sinon.restore());

  const load = (reportOnly = false) => kms._loadCaroots({reportOnly});
  const successes = () => metric.args.filter(([name]) => name.endsWith('_SUCCESS'));
  const tamper = () => {
    const bytes = bundle.slice();

    bytes[2000] = (bytes[2000] + 1) % 256;

    return bytes;
  };

  [false, true].forEach((reportOnly) => {
    ['success', 'download-failed', 'verification-failed'].forEach((outcome) => {
      it(`pairs each completed ${
        reportOnly ? 'report-only' : 'enforced'
      } ${outcome} stage`, async () => {
        const getter = reportOnly ? reportOnlyBytes : enforcedBytes;

        if (outcome === 'download-failed') getter.rejects(new Error('offline'));
        if (outcome === 'verification-failed') getter.resolves(tamper());
        if (outcome === 'success') assert.lengthOf(await load(reportOnly), 231);
        else await assert.isRejected(load(reportOnly));

        const expected = outcome === 'download-failed' ? [] : [assetSuccess(DOWNLOAD, reportOnly)];

        if (outcome === 'success') expected.push(assetSuccess(VERIFIED, reportOnly));
        assert.deepEqual(successes(), expected);
        assert.equal(metric.callCount, outcome === 'download-failed' ? 1 : 2);
        if (outcome !== 'success') {
          const [name, payload] = metric.lastCall.args;

          assert.equal(name, outcome === 'download-failed' ? DOWNLOAD_FAILED : VERIFICATION_FAILED);
          assert.deepEqual(payload.fields, {success: false});
          assert.equal(payload.tags.validationMode, reportOnly ? 'report-only' : 'enforced');
          assert.equal(payload.tags.carootsAsset, UNION_BUNDLE_ASSET);
        }
      });
    });

    it(`does not duplicate shared or cached ${
      reportOnly ? 'report-only' : 'enforced'
    } loads`, async () => {
      let complete: (bytes: Uint8Array) => void = () => {};
      const getter = reportOnly ? reportOnlyBytes : enforcedBytes;

      getter.returns(
        new Promise((resolve) => {
          complete = resolve;
        })
      );
      const pending = [load(reportOnly), load(reportOnly), load(reportOnly)];

      await Promise.resolve();
      assert.notCalled(metric);
      assert.calledOnce(getter);
      complete(bundle.slice());
      const roots = await Promise.all(pending);

      roots.forEach((value) => assert.equal(value, roots[0]));
      assert.equal(await load(reportOnly), roots[0]);
      assert.deepEqual(metric.args, [
        assetSuccess(DOWNLOAD, reportOnly),
        assetSuccess(VERIFIED, reportOnly),
      ]);
      assert.calledOnce(getter);
    });

    it(`captures the ${
      reportOnly ? 'report-only' : 'enforced'
    } filename before config changes`, async () => {
      const pending = load(reportOnly);

      kms.config.carootsAsset = 'changed.bin';
      assert.lengthOf(await pending, 231);
      assert.deepEqual(metric.args, [
        assetSuccess(DOWNLOAD, reportOnly),
        assetSuccess(VERIFIED, reportOnly),
      ]);
    });

    it(`pairs one failed shared ${
      reportOnly ? 'report-only' : 'enforced'
    } load and recovery`, async () => {
      const getter = reportOnly ? reportOnlyBytes : enforcedBytes;

      getter.onFirstCall().rejects(new Error('offline'));
      const errors = await Promise.all(
        [load(reportOnly), load(reportOnly)].map((pending) => pending.catch((error) => error))
      );

      assert.equal(errors[0], errors[1]);
      assert.calledOnce(metric.withArgs(DOWNLOAD_FAILED));
      assert.deepEqual(successes(), []);
      assert.lengthOf(await load(reportOnly), 231);
      assert.lengthOf(await load(reportOnly), 231);
      assert.deepEqual(successes(), [
        assetSuccess(DOWNLOAD, reportOnly),
        assetSuccess(VERIFIED, reportOnly),
      ]);
      assert.equal(metric.callCount, 3);
      assert.calledTwice(getter);
    });

    it(`does not report success for a synchronous ${
      reportOnly ? 'report-only' : 'enforced'
    } download error`, async () => {
      (reportOnly ? reportOnlyBytes : enforcedBytes).throws(new Error('invalid URL'));
      await assert.isRejected(load(reportOnly), 'invalid URL');
      assert.deepEqual(successes(), []);
      assert.calledOnce(metric.withArgs(DOWNLOAD_FAILED));
    });
  });

  it('reports download success while signature verification is still pending', async () => {
    let complete: (result: any) => void = () => {};
    let notifyStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const verification = new Promise((resolve) => {
      complete = resolve;
    });
    const verify = sinon.stub(kmsCaroots, 'verifyUnionBundle').callsFake(() => {
      notifyStarted();

      return verification;
    });
    const pending = load();

    try {
      await started;
      assert.calledOnce(verify);
      assert.deepEqual(metric.args, [assetSuccess(DOWNLOAD)]);
    } finally {
      complete({caroots, bundleVersion: 1, signingTime: new Date()});
      await pending;
    }
    assert.deepEqual(metric.args, [assetSuccess(DOWNLOAD), assetSuccess(VERIFIED)]);
  });

  ['url', 'filename', 'mode'].forEach((change) => {
    it(`counts distinct ${change} sources and reuses the first source`, async () => {
      const roots = await load();
      const originalUrl = kms.config.assetsBaseUrl;

      if (change === 'url') kms.config.assetsBaseUrl = 'https://another.example.com/roots/';
      if (change === 'filename') kms.config.carootsAsset = 'candidate.bin';
      assert.lengthOf(await load(change === 'mode'), 231);
      kms.config.assetsBaseUrl = originalUrl;
      kms.config.carootsAsset = UNION_BUNDLE_ASSET;
      assert.equal(await load(), roots);
      assert.deepEqual(metric.args, [
        assetSuccess(DOWNLOAD),
        assetSuccess(VERIFIED),
        assetSuccess(
          DOWNLOAD,
          change === 'mode',
          change === 'filename' ? 'candidate.bin' : UNION_BUNDLE_ASSET
        ),
        assetSuccess(
          VERIFIED,
          change === 'mode',
          change === 'filename' ? 'candidate.bin' : UNION_BUNDLE_ASSET
        ),
      ]);
    });
  });

  ['disabled', 'supplied roots'].forEach((source) => {
    it(`does not report root-file stages for ${source}`, async () => {
      if (source === 'disabled') {
        kms.config.shouldValidateKMSCertificate = false;
        assert.isUndefined(await kms._getCaroots());
      } else {
        kms.config.caroots = caroots;
        assert.equal(await kms._getCaroots(), caroots);
      }
      assert.notCalled(enforcedBytes);
      assert.notCalled(reportOnlyBytes);
      assert.notCalled(metric);
    });
  });

  it('reports both successful packaged-file stages in Node', async () => {
    enforcedBytes.restore();
    kms.config.assetsBaseUrl = undefined;
    assert.lengthOf(await kms._getCaroots(), 231);
    assert.lengthOf(await kms._getCaroots(), 231);
    assert.deepEqual(metric.args, [assetSuccess(DOWNLOAD), assetSuccess(VERIFIED)]);
  });

  [true, false].forEach((enforced) => {
    it(`${
      enforced ? 'reports' : 'does not report'
    } enforced certificate success with full validation ${
      enforced ? 'enabled' : 'disabled'
    }`, async () => {
      kms.config.shouldValidateKMSCertificate = enforced;
      assert.equal(await kms._validateKMSStaticPubKey(validKey, caroots), validKey);
      assert.deepEqual(metric.args, enforced ? [certificateSuccess()] : []);
    });

    it(`tags mandatory key failures when full validation is ${
      enforced ? 'enabled' : 'disabled'
    }`, async () => {
      kms.config.shouldValidateKMSCertificate = enforced;
      await assert.isRejected(kms._validateKMSStaticPubKey(invalidKey, caroots), /INVALID KMS/);
      assert.deepEqual(metric.args, [
        [
          CERTIFICATE_FAILED,
          {
            fields: {success: false},
            tags: {
              reason: "INVALID KMS: 'kty' header must be 'RSA'",
              kid: invalidKey.kid,
              validationMode: 'enforced',
              signatureValidation: enforced ? 'enabled' : 'disabled',
            },
          },
        ],
      ]);
    });

    ['legacy', 'asset'].forEach((source) => {
      ['valid', 'untrusted', 'missing roots'].forEach((outcome) => {
        it(`pairs ${source} report-only ${outcome} checks with enforcement ${enforced}`, async () => {
          kms.config.shouldValidateKMSCertificate = enforced;
          const roots = {valid: caroots, untrusted: unrelatedCaroots, 'missing roots': []}[outcome];

          if (source === 'legacy') kms.config.carootsReportOnly = roots;
          else {
            kms.config.reportOnlyAssetsBaseUrl = 'https://candidate.example.com/roots/';
            sinon.stub(kms, '_loadCaroots').resolves(roots);
          }
          const report = sinon.spy(kms, '_reportKMSStaticPubKey');

          assert.equal(await kms._validateKMSStaticPubKey(validKey, caroots), validKey);
          if (source === 'asset') await report.returnValues[0];
          else assert.notCalled(report);

          const expected = enforced ? [certificateSuccess()] : [];

          if (outcome === 'valid') expected.push(certificateSuccess(true));
          assert.deepEqual(successes(), expected);
          assert.equal(metric.callCount, Number(enforced) + 1);
          if (outcome !== 'valid') {
            const [name, payload] = metric.lastCall.args;

            assert.equal(name, CERTIFICATE_FAILED);
            assert.deepEqual(payload.fields, {success: false});
            assert.match(payload.tags.reason, /^INVALID KMS:/);
            assert.deepEqual(payload.tags, {
              reason: payload.tags.reason,
              kid: validKey.kid,
              validationMode: 'report-only',
              signatureValidation: 'enabled',
            });
          }
        });
      });
    });
  });

  it('matches the full validator default when the signature option is undefined', async () => {
    kms.config.shouldValidateKMSCertificate = undefined;
    assert.equal(await kms._validateKMSStaticPubKey(validKey, caroots), validKey);
    assert.deepEqual(metric.args, [certificateSuccess()]);
    metric.resetHistory();
    await assert.isRejected(
      kms._validateKMSStaticPubKey(validKey, unrelatedCaroots),
      /INVALID KMS/
    );
    assert.deepEqual(successes(), []);
    assert.calledOnce(metric.withArgs(CERTIFICATE_FAILED));
    assert.equal(metric.firstCall.args[1].tags.signatureValidation, 'enabled');
  });

  [undefined, [], unrelatedCaroots].forEach((roots) => {
    it(`does not report certificate success with ${
      roots?.length ?? 'missing'
    } untrusted roots`, async () => {
      await assert.isRejected(kms._validateKMSStaticPubKey(validKey, roots), /INVALID KMS/);
      assert.deepEqual(successes(), []);
      assert.calledOnce(metric.withArgs(CERTIFICATE_FAILED));
      assert.equal(metric.firstCall.args[1].tags.signatureValidation, 'enabled');
    });
  });

  ['throws', 'rejects'].forEach((submission) => {
    [DOWNLOAD, VERIFIED, CERTIFICATE].forEach((name) => {
      it(`preserves successful work when ${name} submission ${submission}`, async () => {
        const metricError = new Error('metric unavailable');

        metric.withArgs(name)[submission](metricError);
        if (name === CERTIFICATE) {
          assert.equal(await kms._validateKMSStaticPubKey(validKey, caroots), validKey);
          assert.deepEqual(metric.args, [certificateSuccess()]);
        } else {
          assert.lengthOf(await load(), 231);
          assert.deepEqual(metric.args, [assetSuccess(DOWNLOAD), assetSuccess(VERIFIED)]);
        }
        assert.calledWithExactly(
          kms.logger.warn,
          `kms: failed to submit ${name} metric`,
          metricError
        );
      });
    });

    it(`preserves signature rejection when download-success submission ${submission}`, async () => {
      metric.withArgs(DOWNLOAD)[submission](new Error('metric unavailable'));
      enforcedBytes.resolves(tamper());
      await assert.isRejected(load(), 'failed verification');
      assert.deepEqual(successes(), [assetSuccess(DOWNLOAD)]);
      assert.calledOnce(metric.withArgs(VERIFICATION_FAILED));
      assert.notCalled(metric.withArgs(CERTIFICATE_FAILED));
    });
  });

  it('adds no events for repeated activity decrypts with an available content key', async () => {
    const key = await jose.JWK.createKey('oct', 256, {alg: 'A256GCM'});
    const ciphertext = await jose.JWE.createEncrypt({format: 'compact'}, key)
      .update('activity text')
      .final();
    const roots = sinon.spy(kms, '_loadAssetCaroots');

    assert.deepEqual(
      await Promise.all(
        Array.from({length: 25}, () =>
          webex.internal.encryption.decryptText({jwk: key.toJSON(true)}, ciphertext)
        )
      ),
      Array(25).fill('activity text')
    );
    assert.notCalled(roots);
    assert.notCalled(enforcedBytes);
    assert.notCalled(reportOnlyBytes);
    assert.notCalled(metric);
  });
});

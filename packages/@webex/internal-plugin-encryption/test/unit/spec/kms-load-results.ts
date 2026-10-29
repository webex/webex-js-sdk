/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import fs from 'fs';
import path from 'path';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Encryption from '@webex/internal-plugin-encryption';
import jose from 'node-jose';
import sinon from 'sinon';

import {UNION_BUNDLE_ASSET} from '../../../dist/union-bundle';
import {caroots, validKey} from '../../fixtures/kms-certificate';

describe('completed KMS root-file loads', () => {
  const RESULT_EVENT = 'JS_SDK_KMS_CAROOTS_ASSET_LOAD_RESULT';
  const bundle = new Uint8Array(
    fs.readFileSync(path.join(__dirname, '../../../../test-helper-server/static/ios_union.p7b'))
  );
  const resultPayload = (outcome = 'success', reportOnly = false, asset = UNION_BUNDLE_ASSET) => ({
    fields: {success: outcome === 'success'},
    tags: {
      outcome,
      validationMode: reportOnly ? 'report-only' : 'enforced',
      carootsAsset: asset,
    },
  });
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
      reportOnlyAssetsBaseUrl: 'https://candidate.example.com/roots/',
    });
    enforcedBytes = sinon.stub(kms, '_getCarootsAssetBytes').resolves(bundle.slice());
    reportOnlyBytes = sinon.stub(kms, '_getReportOnlyCarootsAssetBytes').resolves(bundle.slice());
  });

  afterEach(() => sinon.restore());

  const load = (reportOnly = false) => kms._loadCaroots({reportOnly});
  const results = () => metric.withArgs(RESULT_EVENT).args;
  const expectedResult = (outcome = 'success', reportOnly = false, asset = UNION_BUNDLE_ASSET) => [
    RESULT_EVENT,
    resultPayload(outcome, reportOnly, asset),
  ];
  const setOutcome = (outcome: string, getter = enforcedBytes) => {
    if (outcome === 'download-failed') getter.rejects(new Error('private download detail'));
    if (outcome === 'verification-failed') {
      const tampered = bundle.slice();

      tampered[2000] = (tampered[2000] + 1) % 256;
      getter.resolves(tampered);
    }
  };

  [false, true].forEach((reportOnly) => {
    ['success', 'download-failed', 'verification-failed'].forEach((outcome) => {
      it(`reports one complete ${
        reportOnly ? 'report-only' : 'enforced'
      } ${outcome} result`, async () => {
        setOutcome(outcome, reportOnly ? reportOnlyBytes : enforcedBytes);
        if (outcome === 'success') assert.lengthOf(await load(reportOnly), 231);
        else await assert.isRejected(load(reportOnly));

        assert.deepEqual(results(), [expectedResult(outcome, reportOnly)]);
        assert.equal(metric.callCount, outcome === 'success' ? 1 : 2);
        assert.notInclude(JSON.stringify(results()), 'private download detail');
      });
    });

    it(`counts the shared ${
      reportOnly ? 'report-only' : 'enforced'
    } load only after it settles`, async () => {
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
      assert.deepEqual(metric.args, [expectedResult('success', reportOnly)]);
      assert.calledOnce(getter);
    });

    it(`retains the original ${
      reportOnly ? 'report-only' : 'enforced'
    } filename while config changes`, async () => {
      const pending = load(reportOnly);

      kms.config.carootsAsset = 'changed.bin';
      assert.lengthOf(await pending, 231);
      assert.deepEqual(metric.args, [expectedResult('success', reportOnly)]);
    });

    it(`counts one failed shared ${
      reportOnly ? 'report-only' : 'enforced'
    } load and one recovery`, async () => {
      const getter = reportOnly ? reportOnlyBytes : enforcedBytes;

      getter.onFirstCall().rejects(new Error('offline'));
      const errors = await Promise.all(
        [load(reportOnly), load(reportOnly)].map((pending) =>
          pending.then(
            () => assert.fail('expected rejection'),
            (error) => error
          )
        )
      );

      assert.equal(errors[0], errors[1]);
      assert.deepEqual(results(), [expectedResult('download-failed', reportOnly)]);
      assert.lengthOf(await load(reportOnly), 231);
      assert.lengthOf(await load(reportOnly), 231);
      assert.deepEqual(results(), [
        expectedResult('download-failed', reportOnly),
        expectedResult('success', reportOnly),
      ]);
      assert.equal(metric.callCount, 3);
      assert.calledTwice(getter);
    });

    it(`counts a synchronous ${
      reportOnly ? 'report-only' : 'enforced'
    } download rejection`, async () => {
      (reportOnly ? reportOnlyBytes : enforcedBytes).throws(new Error('invalid URL'));
      await assert.isRejected(load(reportOnly), 'invalid URL');
      assert.deepEqual(results(), [expectedResult('download-failed', reportOnly)]);
    });
  });

  ['url', 'filename', 'mode'].forEach((change) => {
    it(`counts distinct ${change} sources and reuses the first verified source`, async () => {
      const roots = await load();
      const originalUrl = kms.config.assetsBaseUrl;

      if (change === 'url') kms.config.assetsBaseUrl = 'https://another.example.com/roots/';
      if (change === 'filename') kms.config.carootsAsset = 'candidate.bin';
      assert.lengthOf(await load(change === 'mode'), 231);
      kms.config.assetsBaseUrl = originalUrl;
      kms.config.carootsAsset = UNION_BUNDLE_ASSET;
      assert.equal(await load(), roots);
      assert.deepEqual(metric.args, [
        expectedResult(),
        expectedResult(
          'success',
          change === 'mode',
          change === 'filename' ? 'candidate.bin' : UNION_BUNDLE_ASSET
        ),
      ]);
    });
  });

  ['disabled', 'supplied roots', 'legacy report-only roots'].forEach((source) => {
    it(`does not report a root-file load for ${source}`, async () => {
      if (source === 'disabled') {
        kms.config.shouldValidateKMSCertificate = false;
        assert.isUndefined(await kms._getCaroots());
      } else if (source === 'supplied roots') {
        kms.config.caroots = caroots;
        assert.equal(await kms._getCaroots(), caroots);
      } else {
        kms.config.reportOnlyAssetsBaseUrl = undefined;
        kms.config.carootsReportOnly = caroots;
        assert.equal(await kms._validateKMSStaticPubKey(validKey, caroots), validKey);
      }
      assert.notCalled(enforcedBytes);
      assert.notCalled(reportOnlyBytes);
      assert.notCalled(metric);
    });
  });

  ['throws', 'rejects'].forEach((submission) => {
    ['success', 'download-failed', 'verification-failed'].forEach((outcome) => {
      it(`preserves ${outcome} when result metric submission ${submission}`, async () => {
        const metricError = new Error('metric unavailable');

        metric.withArgs(RESULT_EVENT)[submission](metricError);
        setOutcome(outcome);
        if (outcome === 'success') assert.lengthOf(await load(), 231);
        else
          await assert.isRejected(
            load(),
            outcome === 'download-failed' ? 'could not be loaded' : 'failed verification'
          );
        assert.deepEqual(results(), [expectedResult(outcome)]);
        assert.calledWithExactly(
          kms.logger.warn,
          `kms: failed to submit ${RESULT_EVENT} metric`,
          metricError
        );
      });
    });
  });

  it('reports a successful packaged-file load in Node', async () => {
    enforcedBytes.restore();
    kms.config.assetsBaseUrl = undefined;
    assert.lengthOf(await kms._getCaroots(), 231);
    assert.lengthOf(await kms._getCaroots(), 231);
    assert.deepEqual(metric.args, [expectedResult()]);
  });

  it('adds no root-load events for repeated activity decrypts with an available content key', async () => {
    const key = await jose.JWK.createKey('oct', 256, {alg: 'A256GCM'});
    const ciphertext = await jose.JWE.createEncrypt({format: 'compact'}, key)
      .update('activity text')
      .final();
    const contentKey = {jwk: key.toJSON(true)};
    const roots = sinon.spy(kms, '_loadAssetCaroots');

    assert.deepEqual(
      await Promise.all(
        Array.from({length: 25}, () =>
          webex.internal.encryption.decryptText(contentKey, ciphertext)
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

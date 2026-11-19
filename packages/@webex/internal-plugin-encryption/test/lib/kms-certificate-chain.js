/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {Certificate, CertificateChainValidationEngine} from 'pkijs';
import {Buffer} from 'safe-buffer';
import sinon from 'sinon';

import {certificateChainCases, invalidIdentityCases} from '../fixtures/kms-certificate';
import fixture from '../fixtures/certificate-diagnostics.json';

const describeCertificateChain = (validateKMS, createWebex) => {
  describe('KMS identity certificate chain', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers({
        now: new Date('2030-01-01T00:00:00Z').getTime(),
        toFake: ['Date'],
      });
    });

    afterEach(() => sinon.restore());

    certificateChainCases.forEach(({name, key, roots, valid, date}) => {
      it(`${valid ? 'accepts' : 'rejects'} ${name} without changing the public input`, async () => {
        clock.setSystemTime(new Date(date ?? '2030-01-01T00:00:00Z'));
        const input = Object.freeze({...key, x5c: Object.freeze([...key.x5c])});
        const trusted = Object.freeze([...roots]);

        if (valid) {
          assert.strictEqual(await validateKMS({caroots: trusted})(input), input);
        } else {
          await assert.isRejected(validateKMS({caroots: trusted})(input), /INVALID KMS/);
        }

        assert.deepEqual(input.x5c, key.x5c);
        assert.deepEqual(trusted, roots);
      });
    });

    invalidIdentityCases.forEach(({name, key, error}) => {
      it(`retains the ${name} check when signature validation is disabled`, async () => {
        await assert.isRejected(validateKMS({validateSignature: false})(key), error);
      });
    });

    certificateChainCases
      .filter(({name}) =>
        [
          'expired leaf with valid intermediate',
          'future leaf with valid intermediate',
          'invalid leaf signature',
        ].includes(name)
      )
      .forEach(({name, key, date}) => {
        it(`retains the explicit signature bypass for ${name}`, async () => {
          clock.setSystemTime(new Date(date ?? '2030-01-01T00:00:00Z'));
          assert.strictEqual(await validateKMS({validateSignature: false})(key), key);
        });
      });

    [
      {
        name: 'a different leaf',
        certificatePath: [Certificate.fromBER(Buffer.from(fixture.root, 'base64'))],
      },
      {name: 'an empty path', certificatePath: []},
      {name: 'no path', certificatePath: undefined},
    ].forEach(({name, certificatePath}) => {
      it(`rejects a successful engine result with ${name}`, async () => {
        sinon
          .stub(CertificateChainValidationEngine.prototype, 'verify')
          .resolves({result: true, certificatePath});
        await assert.isRejected(
          validateKMS({caroots: [fixture.root]})(fixture.key),
          /does not start with the KMS identity certificate/
        );
      });
    });

    it('preserves an engine failure even when its path starts with the intended leaf', async () => {
      sinon
        .stub(CertificateChainValidationEngine.prototype, 'verify')
        .callsFake(function rejectPath() {
          return Promise.resolve({
            result: false,
            resultCode: 42,
            resultMessage: 'test policy failure',
            certificatePath: [this.certs[this.certs.length - 1]],
          });
        });
      await assert.isRejected(
        validateKMS({caroots: [fixture.root]})(fixture.key),
        /Certificate Validation failed \[42\]: test policy failure/
      );
    });

    ['enforced', 'explicit report-only', 'background report-only'].forEach((mode) => {
      [true, false].forEach((valid) => {
        it(`preserves ${mode} policy for ${valid ? 'a valid' : 'an invalid'} leaf`, async () => {
          const {kms} = createWebex().internal.encryption;
          const key = valid
            ? fixture.key
            : certificateChainCases.find(({name}) => name === 'invalid leaf signature').key;
          const metric = sinon.stub(kms, '_submitMetric');
          const load = sinon.stub(kms, '_loadCaroots').resolves([fixture.root]);
          const report = sinon.spy(kms, '_reportKMSStaticPubKey');
          const reportUrl = 'https://kms.diagnostics.invalid/roots/';

          kms.config.shouldValidateKMSCertificate = mode === 'enforced';
          kms.config.carootsReportOnly =
            mode === 'explicit report-only' ? [fixture.root] : undefined;
          kms.config.reportOnlyAssetsBaseUrl =
            mode === 'background report-only' ? reportUrl : undefined;

          if (mode === 'enforced' && !valid) {
            await assert.isRejected(
              kms._validateKMSStaticPubKey(key, [fixture.root]),
              /INVALID KMS/
            );
          } else {
            assert.strictEqual(await kms._validateKMSStaticPubKey(key, [fixture.root]), key);
          }

          if (mode === 'background report-only') {
            await report.returnValues[0];
            assert.calledOnceWithExactly(load, {
              reportOnly: true,
              assetsBaseUrl: reportUrl,
              carootsAsset: kms.config.carootsAsset,
            });
          } else {
            assert.notCalled(load);
            assert.notCalled(report);
          }

          if (valid) {
            assert.notCalled(metric);
          } else {
            assert.calledOnceWithExactly(metric, 'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED', {
              fields: {success: false},
              tags: {
                reason: sinon.match(/INVALID KMS/),
                kid: key.kid,
                validationMode: mode === 'enforced' ? 'enforced' : 'report-only',
              },
            });
          }
        });
      });
    });

    it('returns the key before the background check completes and reports its later failure', async () => {
      const {kms} = createWebex().internal.encryption;
      const {key} = certificateChainCases.find(({name}) => name === 'invalid leaf signature');
      const metric = sinon.stub(kms, '_submitMetric');
      const report = sinon.spy(kms, '_reportKMSStaticPubKey');
      let release;

      sinon.stub(kms, '_loadCaroots').returns(
        new Promise((resolve) => {
          release = resolve;
        })
      );
      kms.config.shouldValidateKMSCertificate = false;
      kms.config.carootsReportOnly = undefined;
      kms.config.reportOnlyAssetsBaseUrl = 'https://kms.diagnostics.invalid/roots/';

      assert.strictEqual(await kms._validateKMSStaticPubKey(key, undefined), key);
      assert.calledOnce(report);
      assert.notCalled(metric);
      release([fixture.root]);
      await report.returnValues[0];
      assert.calledOnceWithExactly(metric, 'JS_SDK_KMS_CERTIFICATE_VALIDATION_FAILED', {
        fields: {success: false},
        tags: {reason: sinon.match(/INVALID KMS/), kid: key.kid, validationMode: 'report-only'},
      });
    });
  });
};

export default describeCertificateChain;

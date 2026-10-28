/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import 'jsdom-global/register';

import {assert} from '@webex/test-helper-chai';
import WebexCore, {config as coreConfig} from '@webex/webex-core';
import Webex from 'webex';
import EncryptionUmd from '@webex/plugin-encryption';

import Encryption from '../../../dist/encryption';
import Meetings from '../../../dist/meetings';
import Calling from '../../../dist/calling';

jest.mock('@webex/plugin-meetings', () => ({}));
jest.mock('@webex/internal-plugin-calendar');
jest.mock('@webex/contact-center');
jest.mock('@webex/calling', () => ({
  Logger: {setLogger: jest.fn(), setWebexLogger: jest.fn()},
}));

describe('encryption asset configuration', () => {
  const assetsBaseUrl = 'https://webex-assets.s3.amazonaws.com/sdk/1.2.3/encryption/';
  const entryPoints = [
    {name: 'direct WebexCore', create: (config) => new WebexCore({config})},
    {name: 'full SDK', create: (config) => Webex.init({config})},
    {name: 'encryption wrapper', create: (config) => Encryption.init({config})},
    {name: 'meetings wrapper', create: (config) => Meetings.init({config})},
    {name: 'encryption UMD entry', create: (config) => EncryptionUmd.init({config})},
    {
      name: 'calling wrapper',
      create: async (config) =>
        (
          await Calling.init({
            webexConfig: {config},
            callingConfig: {logger: {level: 'silent'}},
          })
        ).webex,
    },
  ];
  let originalAssetsBaseUrl;

  beforeEach(() => {
    originalAssetsBaseUrl = coreConfig.encryption.assetsBaseUrl;
  });

  afterEach(() => {
    coreConfig.encryption.assetsBaseUrl = originalAssetsBaseUrl;
  });

  entryPoints.forEach(({name, create}) => {
    describe(name, () => {
      it('inherits the local plugin default in an unversioned build', async () => {
        const webex = await create();

        assert.equal(webex.config.encryption.assetsBaseUrl, '/assets/internal-plugin-encryption/');
        assert.isFalse(webex.config.encryption.shouldValidateKMSCertificateReportOnly);
        assert.isFalse(webex.internal.encryption.config.shouldValidateKMSCertificateReportOnly);
        assert.equal(
          webex.internal.encryption.config.assetsBaseUrl,
          webex.config.encryption.assetsBaseUrl
        );
      });

      it('inherits the registered plugin default without a wrapper override', async () => {
        coreConfig.encryption.assetsBaseUrl =
          'https://unpkg.com/webex@3.12.0-next.252/umd/assets/internal-plugin-encryption/';

        const webex = await create();

        assert.equal(webex.config.encryption.assetsBaseUrl, coreConfig.encryption.assetsBaseUrl);
        assert.equal(
          webex.internal.encryption.config.assetsBaseUrl,
          coreConfig.encryption.assetsBaseUrl
        );
      });

      it('preserves background report-only validation and its asset override', async () => {
        const webex = await create({
          encryption: {assetsBaseUrl, shouldValidateKMSCertificateReportOnly: true},
        });

        assert.isFalse(webex.internal.encryption.config.shouldValidateKMSCertificate);
        assert.isTrue(webex.config.encryption.shouldValidateKMSCertificateReportOnly);
        assert.isTrue(webex.internal.encryption.config.shouldValidateKMSCertificateReportOnly);
        assert.equal(webex.internal.encryption.config.assetsBaseUrl, assetsBaseUrl);
      });

      it('preserves an explicit application-hosted URL', async () => {
        const webex = await create({encryption: {assetsBaseUrl}});

        assert.equal(webex.config.encryption.assetsBaseUrl, assetsBaseUrl);
        assert.equal(webex.internal.encryption.config.assetsBaseUrl, assetsBaseUrl);
      });
    });
  });
});

import {assert} from '@webex/test-helper-chai';
import {cloneDeep, merge} from 'lodash';

import defaultConfig, {applyEncryptionConfigOverrides} from '../../../src/config';

describe('internal-plugin-encryption', () => {
  describe('encryption config', () => {
    it('replaces caroots when consumer supplies an empty array', () => {
      const webexConfig = merge({}, defaultConfig, {encryption: {caroots: []}});

      assert.isAbove(webexConfig.encryption.caroots.length, 0);

      applyEncryptionConfigOverrides(webexConfig, {encryption: {caroots: []}});

      assert.deepEqual(webexConfig.encryption.caroots, []);
    });

    it('replaces caroots when consumer supplies a single custom root', () => {
      const customRoot = 'CUSTOM_CA_ROOT';
      const webexConfig = merge({}, defaultConfig, {encryption: {caroots: [customRoot]}});

      assert.isAbove(webexConfig.encryption.caroots.length, 1);
      assert.include(webexConfig.encryption.caroots, customRoot);

      applyEncryptionConfigOverrides(webexConfig, {encryption: {caroots: [customRoot]}});

      assert.deepEqual(webexConfig.encryption.caroots, [customRoot]);
    });

    it('leaves default caroots when consumer does not override caroots', () => {
      const webexConfig = merge({}, defaultConfig, {encryption: {kmsInitialTimeout: 1000}});
      const expectedCaroots = cloneDeep(webexConfig.encryption.caroots);

      applyEncryptionConfigOverrides(webexConfig, {encryption: {kmsInitialTimeout: 1000}});

      assert.deepEqual(webexConfig.encryption.caroots, expectedCaroots);
    });
  });
});

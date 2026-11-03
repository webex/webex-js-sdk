/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {getUmdAssetsBaseUrl} from '@webex/common';

describe('getUmdAssetsBaseUrl()', () => {
  it('builds a versioned UMD asset directory URL', () => {
    const url = getUmdAssetsBaseUrl('plugin-meetings', '3.12.0-next.252', '2.0.0');

    assert.equal(url, 'https://unpkg.com/webex@3.12.0-next.252/umd/assets/plugin-meetings/');
  });

  it('supports other plugin asset directory names', () => {
    const url = getUmdAssetsBaseUrl('plugin-encryption', '4.0.0', '2.0.0');

    assert.equal(url, 'https://unpkg.com/webex@4.0.0/umd/assets/plugin-encryption/');
  });

  it('uses the local asset path for development builds', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      assert.equal(
        getUmdAssetsBaseUrl('plugin-meetings', '3.12.0-next.252', '2.0.0'),
        '/assets/plugin-meetings/'
      );
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('uses the plugin npm package when no SDK version is injected', () => {
    const npmPackageUrl = 'https://unpkg.com/@webex/plugin-meetings@3.12.0/dist/assets/';

    ['', undefined, 'undefined', '0.0.0'].forEach((sdkVersion) => {
      assert.equal(getUmdAssetsBaseUrl('plugin-meetings', sdkVersion, '3.12.0'), npmPackageUrl);
    });
  });

  it('uses the local asset path when neither package version is injected', () => {
    ['', undefined, 'undefined', '0.0.0'].forEach((version) => {
      assert.equal(
        getUmdAssetsBaseUrl('plugin-meetings', version, version),
        '/assets/plugin-meetings/'
      );
    });
  });
});

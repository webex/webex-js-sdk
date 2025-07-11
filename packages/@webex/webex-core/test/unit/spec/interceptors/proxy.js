/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {inBrowser} from '@webex/test-helper-mocha';
import {ProxyInterceptor} from '@webex/webex-core';

import pkg from '../../../../package';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('ProxyInterceptor', () => {
      it('default proxy', () => {
        const interceptor = Reflect.apply(
          ProxyInterceptor.create,
          {
            version: pkg.version,
          },
          []
        );
        const options = {};

        interceptor.onRequest(options);

        assert.isUndefined(options.proxy);
      });

      it('custom proxy', () => {
        const interceptor = Reflect.apply(
          ProxyInterceptor.create,
          {
            version: pkg.version,
            config: {
              proxy: 'http://proxy.company.com'
            },
          },
          []
        );
        const options = {};

        interceptor.onRequest(options);
        if (inBrowser()) {
          assert.isUndefined(options.proxy);
        } else {
          assert.property(options, 'proxy');
          assert.equal(options.proxy, 'http://proxy.company.com');
        }
      });
    });
  });
});

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {skipInBrowser} from '@webex/test-helper-mocha';
import {UserAgentInterceptor} from '@webex/webex-core';

import pkg from '../../../../package';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('UserAgentInterceptor', () => {
      // Do not set custom headers for browsers
      skipInBrowser(describe)('#onRequest', () => {
        it('default user-agent header', () => {
          const interceptor = Reflect.apply(UserAgentInterceptor.create, {
            version: pkg.version
          }, []);
          const options = {headers: {}};

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'user-agent');
          assert.equal(options.headers['user-agent'], '@webex/http-core');
        });

        it('custom user-agent header', () => {
          const interceptor = Reflect.apply(UserAgentInterceptor.create, {
            version: pkg.version,
            config: {
              appName: 'sample',
              appVersion: '1.0.0'
            }
          }, []);
          const options = {headers: {}};

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'user-agent');
          assert.equal(options.headers['user-agent'], 'sample/1.0.0');
        });

        it('custom user-agent header when there is no appVersion', () => {
          const interceptor = Reflect.apply(UserAgentInterceptor.create, {
            version: pkg.version,
            config: {
              appName: 'sample'
            }
          }, []);
          const options = {headers: {}};

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'user-agent');
          assert.equal(options.headers['user-agent'], 'sample/0.0'); // defaults to 0.0
        });
      });
    });
  });
});

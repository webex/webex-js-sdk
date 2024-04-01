/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {WebexUserAgentInterceptor} from '@webex/webex-core';

import pkg from '../../../../package';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('WebexUserAgentInterceptor', () => {
      describe('#onRequest', () => {
        it('adds a basic spark-user-agent header', () => {
          const interceptor = Reflect.apply(
            WebexUserAgentInterceptor.create,
            {
              version: pkg.version,
            },
            []
          );
          const options = {headers: {}};

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'spark-user-agent');
          assert.equal(
            options.headers['spark-user-agent'],
            `webex-js-sdk/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`
          );
        });

        it('adds a complex spark-user-agent header', () => {
          const interceptor = Reflect.apply(
            WebexUserAgentInterceptor.create,
            {
              version: pkg.version,
            },
            []
          );
          const options = {headers: {}};

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'spark-user-agent');
          assert.equal(
            options.headers['spark-user-agent'],
            `webex-js-sdk/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`
          );
        });

        it('adds a spark-user-agent header using appName/appVersion from config', () => {
          const interceptor = Reflect.apply(
            WebexUserAgentInterceptor.create,
            {
              version: pkg.version,
              config: {
                appName: 'sample',
                appVersion: '1.0.0',
              },
            },
            []
          );

          const options = {
            headers: {},
          };

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'spark-user-agent');
          assert.equal(
            options.headers['spark-user-agent'],
            `webex-js-sdk/${pkg.version} (${
              typeof window === 'undefined' ? 'node' : 'web'
            }) sample/1.0.0`
          );
        });

        it('adds a spark-user-agent header using appName/appVersion + appPlatform from config', () => {
          const interceptor = Reflect.apply(
            WebexUserAgentInterceptor.create,
            {
              version: pkg.version,
              config: {
                appName: 'sample',
                appVersion: '1.0.0',
                appPlatform: 'custom-label/1.0.0',
              },
            },
            []
          );

          const options = {
            headers: {},
          };

          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'spark-user-agent');
          assert.equal(
            options.headers['spark-user-agent'],
            `webex-js-sdk/${pkg.version} (${
              typeof window === 'undefined' ? 'node' : 'web'
            }) sample/1.0.0 custom-label/1.0.0`
          );
        });

        describe('when consumed by the webex package', () => {
          it('adds a basic spark-user-agent header using "webex" instead of "webex-js-sdk"', () => {
            const interceptor = Reflect.apply(
              WebexUserAgentInterceptor.create,
              {
                webex: true,
                version: pkg.version,
              },
              []
            );
            const options = {headers: {}};

            interceptor.onRequest(options);

            assert.property(options, 'headers');
            assert.property(options.headers, 'spark-user-agent');
            assert.equal(
              options.headers['spark-user-agent'],
              `webex/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`
            );
          });

          it('adds a complex spark-user-agent header using "webex" instead of "webex-js-sdk"', () => {
            const interceptor = Reflect.apply(
              WebexUserAgentInterceptor.create,
              {
                webex: true,
                version: pkg.version,
              },
              []
            );
            const options = {headers: {}};

            interceptor.onRequest(options);

            assert.property(options, 'headers');
            assert.property(options.headers, 'spark-user-agent');
            assert.equal(
              options.headers['spark-user-agent'],
              `webex/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`
            );
          });
        });
      });
    });
  });
});

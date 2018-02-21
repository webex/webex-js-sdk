/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {SparkUserAgentInterceptor} from '@ciscospark/spark-core';
import pkg from '../../../../package';

describe('spark-core', () => {
  describe('Interceptors', () => {
    describe('SparkUserAgentInterceptor', () => {
      describe('#onRequest', () => {
        it('adds a basic spark-user-agent header', () => {
          const interceptor = Reflect.apply(SparkUserAgentInterceptor.create, {
            version: pkg.version
          }, []);
          const options = {headers: {}};
          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'spark-user-agent');
          assert.equal(options.headers['spark-user-agent'], `spark-js-sdk/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`);
        });

        it('adds a complex spark-user-agent header', () => {
          const interceptor = Reflect.apply(SparkUserAgentInterceptor.create, {
            version: pkg.version,
            config: {
              appName: 'sample',
              appVersion: '1.0.0'
            }
          }, []);
          const options = {headers: {}};
          interceptor.onRequest(options);

          assert.property(options, 'headers');
          assert.property(options.headers, 'spark-user-agent');
          assert.equal(options.headers['spark-user-agent'], `sample/1.0.0 (${typeof window === 'undefined' ? 'node' : 'web'}) spark-js-sdk/${pkg.version}`);
        });

        describe('when consumed by the ciscospark package', () => {
          it('adds a basic spark-user-agent header using "ciscospark" instead of "spark-js-sdk"', () => {
            const interceptor = Reflect.apply(SparkUserAgentInterceptor.create, {
              ciscospark: true,
              version: pkg.version
            }, []);
            const options = {headers: {}};
            interceptor.onRequest(options);

            assert.property(options, 'headers');
            assert.property(options.headers, 'spark-user-agent');
            assert.equal(options.headers['spark-user-agent'], `ciscospark/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`);
          });

          it('adds a complex spark-user-agent header using "ciscospark" instead of "spark-js-sdk"', () => {
            const interceptor = Reflect.apply(SparkUserAgentInterceptor.create, {
              ciscospark: true,
              version: pkg.version,
              config: {
                appName: 'sample',
                appVersion: '1.0.0'
              }
            }, []);
            const options = {headers: {}};
            interceptor.onRequest(options);

            assert.property(options, 'headers');
            assert.property(options.headers, 'spark-user-agent');
            assert.equal(options.headers['spark-user-agent'], `sample/1.0.0 (${typeof window === 'undefined' ? 'node' : 'web'}) ciscospark/${pkg.version}`);
          });
        });
      });
    });
  });
});

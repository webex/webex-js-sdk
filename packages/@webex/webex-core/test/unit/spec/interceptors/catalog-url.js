/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {CatalogUrlInterceptor} from '@webex/webex-core';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('CatalogUrlInterceptor', () => {
      let interceptor;
      let webex;

      beforeEach(() => {
        webex = {
          config: {
            services: {},
          },
          internal: {
            services: {
              getServiceFromUrl: sinon.stub(),
            },
          },
          logger: {
            warn: sinon.stub(),
          },
        };

        interceptor = Reflect.apply(CatalogUrlInterceptor.create, webex, []);
      });

      describe('#onRequest()', () => {
        it('allows catalog URLs', async () => {
          const options = {uri: 'https://conv-a.wbx2.com/conversation/api/v1/messages'};
          webex.internal.services.getServiceFromUrl.returns({name: 'conversation'});

          const result = await interceptor.onRequest(options);

          assert.deepEqual(result, options);
          assert.calledOnceWithExactly(webex.internal.services.getServiceFromUrl, options.uri);
        });

        it('blocks non-catalog URLs with error', async () => {
          const options = {uri: 'https://evil.attacker.com/steal-data'};
          webex.internal.services.getServiceFromUrl.returns(undefined);

          await assert.isRejected(
            interceptor.onRequest(options),
            /Request blocked: URL not in service catalog/
          );
          assert.calledOnce(webex.internal.services.getServiceFromUrl);
        });

        it('allows non-catalog URLs with allowNonCatalogUrl: true', async () => {
          const options = {
            uri: 'https://idbroker.webex.com/idb/oauth2/v1/access_token',
            allowNonCatalogUrl: true,
          };

          const result = await interceptor.onRequest(options);

          assert.deepEqual(result, options);
          assert.notCalled(webex.internal.services.getServiceFromUrl);
        });

        describe('service parameter bypass', () => {
          it('skips validation when service parameter is present', async () => {
            const options = {
              service: 'conversation',
              resource: '/messages',
            };

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
            assert.notCalled(webex.internal.services.getServiceFromUrl);
          });
        });

        describe('url parameter support', () => {
          it('validates options.url when options.uri is not present', async () => {
            const options = {url: 'https://conv-a.wbx2.com/conversation/api/v1/messages'};
            webex.internal.services.getServiceFromUrl.returns({name: 'conversation'});

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
            assert.calledOnceWithExactly(webex.internal.services.getServiceFromUrl, options.url);
          });
        });

        describe('edge cases', () => {
          it('allows request when no URL is present', async () => {
            const options = {method: 'GET'};

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
            assert.notCalled(webex.internal.services.getServiceFromUrl);
          });

          it('handles missing services plugin gracefully', async () => {
            webex.internal = undefined;
            const options = {uri: 'https://example.com/api'};

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
          });
        });

        describe('security scenarios', () => {
          it('blocks Mercury-injected malicious URLs', async () => {
            // This is the SSRF attack vector: Mercury event contains attacker URL
            // that the flag plugin would POST to without validation
            const options = {
              method: 'POST',
              uri: 'https://attacker-controlled.com/exfiltrate',
              body: {sensitiveData: 'secrets'},
            };
            webex.internal.services.getServiceFromUrl.returns(undefined);

            await assert.isRejected(interceptor.onRequest(options), /Request blocked/);
          });

          it('allows legitimate activity service URLs', async () => {
            const options = {
              method: 'POST',
              uri: 'https://conv-a.wbx2.com/conversation/api/v1/activities/12345',
              body: {verb: 'flag'},
            };
            webex.internal.services.getServiceFromUrl.returns({name: 'conversation'});

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
          });

          it('blocks URLs with similar-looking hostnames', async () => {
            // Attacker might try to use a URL that looks similar to a catalog URL
            const options = {
              uri: 'https://conv-a.wbx2.com.attacker.com/api',
            };
            webex.internal.services.getServiceFromUrl.returns(undefined);

            await assert.isRejected(interceptor.onRequest(options), /Request blocked/);
          });
        });
      });
    });
  });
});

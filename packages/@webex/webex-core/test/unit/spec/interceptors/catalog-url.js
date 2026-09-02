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

        describe('service parameter bypass', () => {
          it('skips validation when service has not been resolved to a URL', async () => {
            const options = {
              service: 'conversation',
              resource: '/messages',
            };

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
            assert.notCalled(webex.internal.services.getServiceFromUrl);
          });

          it('blocks a non-catalog URL when service is also present', async () => {
            const options = {
              service: 'conversation',
              resource: '/messages',
              uri: 'https://attacker.com/steal',
              headers: {authorization: 'Bearer token'},
            };
            webex.internal.services.getServiceFromUrl.returns(undefined);

            await assert.isRejected(interceptor.onRequest(options), /Request blocked/);
            assert.calledOnceWithExactly(webex.internal.services.getServiceFromUrl, options.uri);
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

        describe('allowedDomains support', () => {
          beforeEach(() => {
            // Add allowedDomains methods to mock
            webex.internal.services.validateDomains = true;
            webex.internal.services.hasAllowedDomains = sinon.stub();
            webex.internal.services.isAllowedDomainUrl = sinon.stub();
          });

          it('allows URLs in allowedDomains when not in catalog', async () => {
            const options = {uri: 'https://cdn.example.com/files/encrypted-attachment.bin'};
            webex.internal.services.getServiceFromUrl.returns(undefined);
            webex.internal.services.hasAllowedDomains.returns(true);
            webex.internal.services.isAllowedDomainUrl.returns(true);

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
            assert.calledOnceWithExactly(webex.internal.services.isAllowedDomainUrl, options.uri);
          });

          it('blocks URLs not in catalog and not in allowedDomains', async () => {
            const options = {uri: 'https://attacker.com/steal'};
            webex.internal.services.getServiceFromUrl.returns(undefined);
            webex.internal.services.hasAllowedDomains.returns(true);
            webex.internal.services.isAllowedDomainUrl.returns(false);

            await assert.isRejected(
              interceptor.onRequest(options),
              /Request blocked: URL not in service catalog or allowed domains/
            );
          });

          it('blocks when validateDomains is false', async () => {
            const options = {uri: 'https://cdn.example.com/files/attachment.bin'};
            webex.internal.services.validateDomains = false;
            webex.internal.services.getServiceFromUrl.returns(undefined);
            webex.internal.services.hasAllowedDomains.returns(true);
            webex.internal.services.isAllowedDomainUrl.returns(true);

            await assert.isRejected(interceptor.onRequest(options), /Request blocked/);
            assert.notCalled(webex.internal.services.isAllowedDomainUrl);
          });

          it('blocks when no allowedDomains configured', async () => {
            const options = {uri: 'https://cdn.example.com/files/attachment.bin'};
            webex.internal.services.getServiceFromUrl.returns(undefined);
            webex.internal.services.hasAllowedDomains.returns(false);

            await assert.isRejected(interceptor.onRequest(options), /Request blocked/);
            assert.notCalled(webex.internal.services.isAllowedDomainUrl);
          });

          it('skips allowedDomains check when URL is in catalog', async () => {
            const options = {uri: 'https://conv-a.wbx2.com/conversation/api/v1/messages'};
            webex.internal.services.getServiceFromUrl.returns({name: 'conversation'});

            const result = await interceptor.onRequest(options);

            assert.deepEqual(result, options);
            assert.notCalled(webex.internal.services.hasAllowedDomains);
            assert.notCalled(webex.internal.services.isAllowedDomainUrl);
          });
        });
      });
    });
  });
});

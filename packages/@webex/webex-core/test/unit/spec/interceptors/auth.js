/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';
import Logger from '@webex/plugin-logger';
import MockWebex from '@webex/test-helper-mock-webex';
import {AuthInterceptor, config, Credentials, WebexHttpError, Token} from '@webex/webex-core';
import {cloneDeep, merge} from 'lodash';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('AuthInterceptor', () => {
      let interceptor, webex;

      beforeEach(() => {
        webex = new MockWebex({
          children: {
            credentials: Credentials,
            logger: Logger,
          },
          config: merge(cloneDeep(config), {credentials: {client_secret: 'fake'}}),
        });

        webex.credentials.supertoken = new Token(
          {
            access_token: 'ST1',
            token_type: 'Bearer',
          },
          {parent: webex}
        );

        interceptor = Reflect.apply(AuthInterceptor.create, webex, []);
      });

      describe('#onRequest()', () => {
        it('does not replace the auth header if one has been provided', () =>
          interceptor
            .onRequest({
              uri: `${config.services.discovery.hydra}/ping`,
              headers: {
                authorization: 'Bearer Alternate',
              },
            })
            .then((result) =>
              assert.deepEqual(result, {
                uri: `${config.services.discovery.hydra}/ping`,
                headers: {
                  authorization: 'Bearer Alternate',
                },
              })
            ));

        [undefined, null, false].forEach((falsey) => {
          it(`does not add an auth header if ${falsey} has been provided`, () =>
            interceptor
              .onRequest({
                uri: `${config.services.discovery.hydra}/ping`,
                headers: {
                  authorization: falsey,
                },
              })
              .then((result) =>
                assert.deepEqual(result, {
                  uri: `${config.services.discovery.hydra}/ping`,
                  headers: {},
                })
              ));
        });

        // There should never be a case in which the services plugin is not
        // loaded. But testing for legacy support.
        describe('when the services plugin has not been loaded', () => {
          it('does not add the auth header to hydra requests', () =>
            interceptor
              .onRequest({
                uri: `${config.services.discovery.hydra}/ping`,
              })
              .then((result) =>
                assert.deepEqual(result, {
                  uri: `${config.services.discovery.hydra}/ping`,
                  headers: {},
                })
              ));

          it('does not add the auth header to u2c requests', () =>
            interceptor
              .onRequest({
                uri: `${config.services.discovery.u2c}/ping`,
              })
              .then((result) =>
                assert.deepEqual(result, {
                  uri: `${config.services.discovery.u2c}/ping`,
                  headers: {},
                })
              ));
        });

        describe('when the services plugin has been loaded', () => {
          let services;

          beforeEach(() => {
            services = {
              hydra: 'https://hydra-a.wbx.com',
              example: 'https://service.example.com',
            };

            webex.internal.services = {
              hasService: (service) => Object.keys(services).includes(service),
              hasAllowedDomains: () => true,
              isAllowedDomainUrl: (uri) =>
                !!config.services.allowedDomains.find((host) => uri.includes(host)),
              getServiceFromUrl: (uri) => {
                let targetKey;

                Object.keys(services).forEach((key) => {
                  if (uri.includes(services[key])) {
                    targetKey = key;
                  }
                });

                return targetKey ? {name: targetKey} : undefined;
              },
            };

            webex.internal.services.waitForService = (pto) =>
              Promise.resolve(services[pto.name] || pto.url);
          });

          it('adds the header to hydra requests', () =>
            Promise.all([
              interceptor.onRequest({uri: `${services.hydra}/ping`}).then((result) =>
                assert.deepEqual(result, {
                  uri: `${services.hydra}/ping`,
                  headers: {
                    authorization: 'Bearer ST1',
                  },
                })
              ),
              interceptor
                .onRequest({
                  service: 'hydra',
                  resource: 'ping',
                })
                .then((result) =>
                  assert.deepEqual(result, {
                    service: 'hydra',
                    resource: 'ping',
                    headers: {
                      authorization: 'Bearer ST1',
                    },
                  })
                ),
            ]));

          it('adds an auth header to uris that are in the service catalog', () =>
            interceptor
              .onRequest({
                uri: `${services.example}/ping`,
              })
              .then((result) =>
                assert.deepEqual(result, {
                  uri: `${services.example}/ping`,
                  headers: {
                    authorization: 'Bearer ST1',
                  },
                })
              ));

          it('adds an auth header to services that are in the service catalog', () =>
            interceptor
              .onRequest({
                service: 'example',
                resource: 'some-resource',
              })
              .then((result) =>
                assert.deepEqual(result, {
                  service: 'example',
                  resource: 'some-resource',
                  headers: {
                    authorization: 'Bearer ST1',
                  },
                })
              ));

          it('does not add an auth header to uris not in the service catalog', () =>
            interceptor
              .onRequest({
                uri: 'https://not-a-service.com/ping',
              })
              .then((result) =>
                assert.deepEqual(result, {
                  headers: {},
                  uri: 'https://not-a-service.com/ping',
                })
              ));

          it('does not add an auth header to non-existant services', () =>
            interceptor
              .onRequest({
                service: 'non-existant',
                resource: 'no-resource',
              })
              .then((result) =>
                assert.deepEqual(result, {
                  headers: {},
                  service: 'non-existant',
                  resource: 'no-resource',
                })
              ));
        });
      });

      describe('#requiresCredentials()', () => {
        let services;

        beforeEach(() => {
          services = {
            hydra: 'https://hydra-a.wbx.com',
            u2c: 'https://u2c.wbx2.com/u2c/api/v1',
            example: 'https://service.example.com',
          };

          webex.internal.services = {
            getServiceFromUrl: (uri) => {
              let targetKey;

              Object.keys(services).forEach((key) => {
                if (uri.includes(services[key])) {
                  targetKey = key;
                }
              });

              return targetKey ? {name: targetKey} : undefined;
            },
            hasService: (service) => Object.keys(services).includes(service),
            hasAllowedDomains: () => true,
            isAllowedDomainUrl: (uri) =>
              !!config.services.allowedDomains.find((host) => uri.includes(host)),
            validateDomains: true,
          };

          webex.internal.services.waitForService = (pto) =>
            Promise.resolve(services[pto.name] || pto.url);
        });

        afterEach(() => {
          if (webex.internal.services) {
            delete webex.internal.services;
          }
        });

        it('resolves to false when services plugin does not exist', () => {
          delete webex.internal.services;

          return interceptor
            .requiresCredentials({
              uri: `${services.hydra}/ping`,
            })
            .then((response) => assert.isFalse(response));
        });

        it('resolves to true when the u2c service is specified via service', () => {
          services = {};

          return interceptor
            .requiresCredentials({
              service: 'u2c',
              resource: 'something',
            })
            .then((response) => assert.isTrue(response));
        });

        it('resolves to false when the u2c limited service is used via uri', () =>
          interceptor
            .requiresCredentials({
              uri: `${services.u2c}/limited`,
            })
            .then((response) => assert.isFalse(response)));

        it('resolves to true if the service exists in catalog via service', () =>
          interceptor
            .requiresCredentials({service: 'hydra'})
            .then((response) => assert.isTrue(response)));

        it('resolves to true if the service exists in catalog via uri', () =>
          interceptor
            .requiresCredentials({uri: services.hydra})
            .then((response) => assert.isTrue(response)));

        it('resolves to false if that `addAuthHeader` is set to false', () =>
          interceptor
            .requiresCredentials({
              addAuthHeader: false,
              service: 'unknown',
              resource: 'ping',
            })
            .then((response) => assert.isFalse(response)));

        it('resolves to false if `validateDomains` is set to false', () => {
          webex.internal.services.validateDomains = false;

          return interceptor
            .requiresCredentials({
              uri: 'https://allowed-uri.com/resource',
            })
            .then((response) => assert.isFalse(response));
        });

        it('resolves to true with an allowed domain uri', () =>
          interceptor
            .requiresCredentials({
              uri: `https://${config.services.allowedDomains[0]}/resource`,
            })
            .then((response) => assert.isTrue(response)));

        it('resolves to false with a non-allowed uri', () =>
          interceptor
            .requiresCredentials({
              uri: 'https://not-allowed/resource',
            })
            .then((response) => assert.isFalse(response)));

        it('should return true if domain exists using  isAllowedDomainUrl()', () => {
          webex.internal.services.waitForService = sinon.stub();
          const {isAllowedDomainUrl} = webex.internal.services;

          const result = isAllowedDomainUrl(
            `https://${config.services.allowedDomains[0]}/resource`
          );

          assert.equal(result, true);
        });

        it('should return true when called `requiresCredentials` with valid url', () => {
          webex.internal.services.waitForService = sinon.stub();

          return interceptor
            .requiresCredentials({
              uri: `https://${config.services.allowedDomains[0]}/resource`,
            })
            .then((res) => {
              assert.equal(res, true);
            });
        });

        it('should call waitForService()', () => {
          webex.internal.services.waitForService = sinon.stub();
          const {waitForService} = webex.internal.services;

          waitForService.resolves(`https://${config.services.allowedDomains[0]}/resource`);

          return interceptor
            .requiresCredentials({
              service: 'locus',
            })
            .then(() => assert.calledOnce(waitForService));
        });
      });

      describe('#onResponseError()', () => {
        describe('when the server responds with 401', () => {
          nodeOnly(it)('refreshes the access token and replays the request', () => {
            webex.request.onCall(0).returns(
              Promise.resolve({
                body: {
                  access_token: 'ST2',
                },
              })
            );
            webex.credentials.supertoken = new Token(
              {
                access_token: 'ST1',
                refresh_token: 'RT1',
              },
              {parent: webex}
            );

            const err = new WebexHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg',
                },
                uri: `${config.services.discovery.hydra}/ping`,
              },
              body: {
                error: 'fake error',
              },
            });

            assert.notCalled(webex.request);

            return interceptor.onResponseError(err.options, err).then(() => {
              // once for refresh, once for replay
              assert.calledTwice(webex.request);
              assert.equal(webex.credentials.supertoken.access_token, 'ST2');
              assert.equal(webex.request.args[1][0].replayCount, 1);
            });
          });

          browserOnly(it)('refreshes the access token and replays the request', () => {
            webex.config.credentials.refreshCallback = sinon.stub().returns(
              Promise.resolve({
                access_token: 'ST2',
              })
            );

            webex.credentials.supertoken = new Token(
              {
                access_token: 'ST1',
                refresh_token: 'RT1',
              },
              {parent: webex}
            );

            const err = new WebexHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg',
                },
                uri: `${config.services.discovery.hydra}/ping`,
              },
              body: {
                error: 'fake error',
              },
            });

            assert.notCalled(webex.request);

            return interceptor.onResponseError(err.options, err).then(() => {
              // once for replay
              assert.calledOnce(webex.request);
              assert.equal(webex.credentials.supertoken.access_token, 'ST2');
              assert.equal(webex.request.args[0][0].replayCount, 1);
            });
          });

          describe('when the access token is not refreshable', () => {
            it('responds with the original error', () => {
              webex.credentials.supertoken = new Token(
                {
                  access_token: 'ST1',
                },
                {parent: webex}
              );

              const err = new WebexHttpError.Unauthorized({
                statusCode: 401,
                options: {
                  headers: {
                    trackingid: 'blarg',
                  },
                  uri: `${config.services.discovery.hydra}/ping`,
                },
                body: {
                  error: 'fake error',
                },
              });

              assert.notCalled(webex.request);

              return assert
                .isRejected(interceptor.onResponseError(err.options, err))
                .then((err2) => {
                  assert.equal(err2, err);
                });
            });
          });

          it('does not refresh if shouldRefreshAccessToken was false', () => {
            webex.config.credentials.refreshCallback = sinon.stub().returns(
              Promise.resolve({
                access_token: 'ST2',
              })
            );

            webex.credentials.supertoken = new Token(
              {
                access_token: 'ST1',
                refresh_token: 'RT1',
              },
              {parent: webex}
            );

            const err = new WebexHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg',
                },
                uri: `${config.services.discovery.hydra}/ping`,
                shouldRefreshAccessToken: false,
              },
              body: {
                error: 'fake error',
              },
            });

            assert.notCalled(webex.request);

            return assert.isRejected(interceptor.onResponseError(err.options, err)).then((err2) => {
              assert.equal(err2, err);
            });
          });
        });
      });
    });
  });
});

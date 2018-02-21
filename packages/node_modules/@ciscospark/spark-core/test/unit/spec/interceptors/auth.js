/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */

import sinon from '@ciscospark/test-helper-sinon';
import {assert} from '@ciscospark/test-helper-chai';
import {browserOnly, nodeOnly} from '@ciscospark/test-helper-mocha';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import {
  AuthInterceptor,
  config,
  Credentials,
  SparkHttpError,
  Token
} from '@ciscospark/spark-core';
import {cloneDeep} from 'lodash';

describe('spark-core', () => {
  describe('Interceptors', () => {
    describe('AuthInterceptor', () => {
      let interceptor, spark;
      beforeEach(() => {
        spark = new MockSpark({
          children: {
            credentials: Credentials
          },
          config: cloneDeep(config)
        });

        spark.credentials.supertoken = new Token({
          access_token: 'ST1',
          token_type: 'Bearer'
        }, {parent: spark});

        interceptor = Reflect.apply(AuthInterceptor.create, spark, []);
      });

      describe('#onRequest()', () => {
        it('does not replace the auth header if one has been provided', () => interceptor.onRequest({
          uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
          headers: {
            authorization: 'Bearer Alternate'
          }
        })
          .then((result) => assert.deepEqual(result, {
            uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
            headers: {
              authorization: 'Bearer Alternate'
            }
          })));

        [undefined, null, false].forEach((falsey) => {
          it(`does not add an auth header if ${falsey} has been provided`, () => interceptor.onRequest({
            uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
            headers: {
              authorization: falsey
            }
          })
            .then((result) => assert.deepEqual(result, {
              uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
              headers: {}
            })));
        });


        describe('when the wdm plugin has not been loaded', () => {
          it('adds an auth header to hydra requests', () => interceptor.onRequest({
            uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`
          })
            .then((result) => assert.deepEqual(result, {
              uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
              headers: {
                authorization: 'Bearer ST1'
              }
            })));
        });

        describe('when the wdm plugin has been loaded', () => {
          beforeEach(() => {
            const services = {
              hydraServiceUrl: 'https://hydra-a.wbx.com',
              exampleServiceUrl: 'https://service.example.com'
            };

            spark.internal.device = {
              isSpecificService(service, uri) {
                return Promise.resolve(services[service] && uri.includes(services[service]));
              },

              isService(service) {
                return !!services[`${service}ServiceUrl`];
              },

              isServiceUrl(uri) {
                return Promise.resolve(Object.keys(services).reduce((acc, key) => acc || uri.includes(services[key]), false));
              },

              services
            };
          });

          it('adds an auth header to hydra requests', () => Promise.all([
            interceptor.onRequest({
              uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`
            })
              .then((result) => assert.deepEqual(result, {
                uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
                headers: {
                  authorization: 'Bearer ST1'
                }
              })),
            interceptor.onRequest({
              uri: 'https://hydra-a.wbx.com/ping'
            })
              .then((result) => assert.deepEqual(result, {
                uri: 'https://hydra-a.wbx.com/ping',
                headers: {
                  authorization: 'Bearer ST1'
                }
              })),
            interceptor.onRequest({
              service: 'hydra',
              resource: 'ping'
            })
              .then((result) => assert.deepEqual(result, {
                service: 'hydra',
                resource: 'ping',
                headers: {
                  authorization: 'Bearer ST1'
                }
              }))
          ]));

          it('adds an auth header to service catalog requests', () => Promise.all([
            interceptor.onRequest({
              uri: 'https://service.example.com/ping'
            })
              .then((result) => assert.deepEqual(result, {
                uri: 'https://service.example.com/ping',
                headers: {
                  authorization: 'Bearer ST1'
                }
              })),
            interceptor.onRequest({
              uri: 'https://not-a-service.example.com/ping'
            })
              .then((result) => assert.deepEqual(result, {
                headers: {},
                uri: 'https://not-a-service.example.com/ping'
              }))
          ]));
        });
      });

      describe('#onResponseError', () => {
        describe('when the server responds with 401', () => {
          nodeOnly(it)('refreshes the access token and replays the request', () => {
            spark.request.onCall(0).returns(Promise.resolve({
              body: {
                access_token: 'ST2'
              }
            }));

            spark.credentials.supertoken = new Token({
              access_token: 'ST1',
              refresh_token: 'RT1'
            }, {parent: spark});

            const err = new SparkHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg'
                },
                uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`
              },
              body: {
                error: 'fake error'
              }
            });
            assert.notCalled(spark.request);
            return interceptor.onResponseError(err.options, err)
              .then(() => {
                // once for refresh, once for replay
                assert.calledTwice(spark.request);
                assert.equal(spark.credentials.supertoken.access_token, 'ST2');
                assert.equal(spark.request.args[1][0].replayCount, 1);
              });
          });

          browserOnly(it)('refreshes the access token and replays the request', () => {
            spark.config.credentials.refreshCallback = sinon.stub().returns(Promise.resolve({
              access_token: 'ST2'
            }));

            spark.credentials.supertoken = new Token({
              access_token: 'ST1',
              refresh_token: 'RT1'
            }, {parent: spark});

            const err = new SparkHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg'
                },
                uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`
              },
              body: {
                error: 'fake error'
              }
            });
            assert.notCalled(spark.request);
            return interceptor.onResponseError(err.options, err)
              .then(() => {
                // once for replay
                assert.calledOnce(spark.request);
                assert.equal(spark.credentials.supertoken.access_token, 'ST2');
                assert.equal(spark.request.args[0][0].replayCount, 1);
              });
          });

          describe('when the access token is not refreshable', () => {
            it('responds with the original error', () => {
              spark.credentials.supertoken = new Token({
                access_token: 'ST1'
              }, {parent: spark});

              const err = new SparkHttpError.Unauthorized({
                statusCode: 401,
                options: {
                  headers: {
                    trackingid: 'blarg'
                  },
                  uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`
                },
                body: {
                  error: 'fake error'
                }
              });
              assert.notCalled(spark.request);
              return assert.isRejected(interceptor.onResponseError(err.options, err))
                .then((err2) => {
                  assert.equal(err2, err);
                });
            });
          });

          it('does not refresh if shouldRefreshAccessToken was false', () => {
            spark.config.credentials.refreshCallback = sinon.stub().returns(Promise.resolve({
              access_token: 'ST2'
            }));

            spark.credentials.supertoken = new Token({
              access_token: 'ST1',
              refresh_token: 'RT1'
            }, {parent: spark});

            const err = new SparkHttpError.Unauthorized({
              statusCode: 401,
              options: {
                headers: {
                  trackingid: 'blarg'
                },
                uri: `${config.device.preDiscoveryServices.hydraServiceUrl}/ping`,
                shouldRefreshAccessToken: false
              },
              body: {
                error: 'fake error'
              }
            });

            assert.notCalled(spark.request);
            return assert.isRejected(interceptor.onResponseError(err.options, err))
              .then((err2) => {
                assert.equal(err2, err);
              });
          });
        });
      });
    });
  });
});

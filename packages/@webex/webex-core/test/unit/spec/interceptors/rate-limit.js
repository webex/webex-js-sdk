/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import FakeTimers from '@sinonjs/fake-timers';
import {
  RateLimitInterceptor,
  config,
  Credentials,
  WebexHttpError,
  Token
} from '@webex/webex-core';
import {cloneDeep} from 'lodash';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('RateLimitInterceptor', () => {
      const idBrokerURL = process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com';
      const identityURL = process.env.IDENTITY_BASE_URL || 'https://identity.webex.com';
      let clock,
        interceptor,
        webex;

      beforeEach(() => {
        webex = new MockWebex({
          children: {
            credentials: Credentials
          },
          config: cloneDeep(config)
        });

        webex.credentials.supertoken = new Token({
          access_token: 'ST1',
          token_type: 'Bearer'
        }, {parent: webex});

        interceptor = Reflect.apply(RateLimitInterceptor.create, webex, []);
        clock = FakeTimers.install({now: Date.now()});
      });

      afterEach(() => {
        clock.uninstall();
      });

      describe('#isRateLimited', () => {
        it('returns false when previously rate limited idbroker API expiry time has been met', () => {
          interceptor.setRateLimitExpiry(`${idBrokerURL}/horse/v1/myID`, 1);
          clock.tick(2000);

          return assert.equal(interceptor.isRateLimited(`${idBrokerURL}/horse/v1/myID`), false);
        });
        it('returns false when previously rate limited identity API expiry time has been met', () => {
          interceptor.setRateLimitExpiry(`${identityURL}/horse/v1/myID`, 1);
          clock.tick(2000);

          return assert.equal(interceptor.isRateLimited(`${identityURL}/horse/v1/myID`), false);
        });
        it('returns false when URI is not IDbroker URI', () => assert.equal(interceptor.isRateLimited('https://example.com/testFake'), false));
        it('returns false if the URI is null', () => assert.equal(interceptor.isRateLimited(null), false));
        it.skip('returns true when idbroker API is rate limited', () => {
          interceptor.setRateLimitExpiry(`${idBrokerURL}/horse/v1/myID`, new Date().getTime() * 2);

          return assert.equal(interceptor.isRateLimited(`${idBrokerURL}/horse/v1/myID`), true);
        });
        it.skip('returns true when identity API is rate limited', () => {
          interceptor.setRateLimitExpiry(`${identityURL}/horse/v1/myID`, new Date().getTime() * 2);

          return assert.equal(interceptor.isRateLimited(`${identityURL}/horse/v1/myID`), true);
        });
      });

      describe('#getApiName', () => {
        it('returns null when there is no regex match', () => assert.equal(interceptor.getApiName('https://example.com/testFake'), null));
        it('returns null when the argument is null', () => assert.equal(interceptor.getApiName(null), null));
        it.skip('returns idbroker API name if there is a match', () => assert.equal(interceptor.getApiName(`${idBrokerURL}/horse/v1/myID`), 'horse'));
        it.skip('returns identity API name if there is a match', () => assert.equal(interceptor.getApiName(`${identityURL}/horse/v1/myID`), 'horse'));
      });

      describe('#getRateLimitStatus', () => {
        it('returns false if API name is not in rate limit expiry map', () => assert.equal(interceptor.getRateLimitStatus('https://example.com/testFake'), false));
        it('returns false if idbroker API name is not rate limited', () => {
          interceptor.setRateLimitExpiry(`${idBrokerURL}/horse/v1/myID`, 1);
          clock.tick(2000);

          return assert.equal(interceptor.getRateLimitStatus(`${idBrokerURL}/horse/v1/myID`), false);
        });
        it('returns false if identity API name is not rate limited', () => {
          interceptor.setRateLimitExpiry(`${identityURL}/horse/v1/myID`, 1);
          clock.tick(2000);

          return assert.equal(interceptor.getRateLimitStatus(`${identityURL}/horse/v1/myID`), false);
        });
        it.skip('returns true if idbroker the API name is rate limited', () => {
          const future = (new Date().getTime()) * 2;

          interceptor.setRateLimitExpiry(`${idBrokerURL}/horse/v1/myID`, future);

          return assert.equal(interceptor.getRateLimitStatus(`${idBrokerURL}/horse/v1/myID`), true);
        });
        it.skip('returns true if the identity API name is rate limited', () => {
          const future = (new Date().getTime()) * 2;

          interceptor.setRateLimitExpiry(`${identityURL}/horse/v1/myID`, future);

          return assert.equal(interceptor.getRateLimitStatus(`${identityURL}/horse/v1/myID`), true);
        });
      });

      describe('#setRateLimitExpiry', () => {
        it('returns false if URI results in API name that is null', () => assert.equal(interceptor.setRateLimitExpiry('https://example.com/testFake', 1), false));
        it.skip('sets expiry if idroker URI results in API name that can be mapped', () => {
          interceptor.setRateLimitExpiry(`${idBrokerURL}/horse/v1/myID`, new Date().getTime() * 2);

          return assert.equal(interceptor.getRateLimitStatus(`${idBrokerURL}/horse/v1/myID`), true);
        });
        it.skip('sets expiry if identity URI results in API name that can be mapped', () => {
          interceptor.setRateLimitExpiry(`${identityURL}/horse/v1/myID`, new Date().getTime() * 2);

          return assert.equal(interceptor.getRateLimitStatus(`${identityURL}/horse/v1/myID`), true);
        });
      });

      describe('#extractRetryAfterTime', () => {
        const milliMultiplier = 1000;

        it('returns 60K milliseconds when retry-after <= 0S', () => assert.equal(interceptor.extractRetryAfterTime({headers: {'retry-after': -1}}), 60 * milliMultiplier));
        it('returns 60K milliseconds when retry-after is null', () => assert.equal(interceptor.extractRetryAfterTime({headers: {'retry-after-missing': 10}}), 60 * milliMultiplier));
        it('returns 3600K milliseconds when retry-after is > 3600S', () => assert.equal(interceptor.extractRetryAfterTime({headers: {'retry-after': 7200}}), 3600 * milliMultiplier));
        it('returns retry-after * 1000 (converts to milliseconds) if 0S < retry-after < 3600S', () => assert.equal(interceptor.extractRetryAfterTime({headers: {'retry-after': 55}}), 55 * milliMultiplier));
      });

      describe('#onRequest', () => {
        it('Rejects idbroker request if API is rate limited', () => {
          const future = (new Date().getTime() / 1000) * 2;

          interceptor.setRateLimitExpiry(`${idBrokerURL}/horse/v1/myID`, future);

          return interceptor.onRequest({uri: `${idBrokerURL}/horse/v1/myID`}).catch((err) => {
            assert.notCalled(webex.request);
            assert.equal(err.message, `API rate limited ${idBrokerURL}/horse/v1/myID`);
          });
        });
        it('Rejects identity request if API is rate limited', () => {
          const future = (new Date().getTime() / 1000) * 2;

          interceptor.setRateLimitExpiry(`${identityURL}/horse/v1/myID`, future);

          return interceptor.onRequest({uri: `${identityURL}/horse/v1/myID`}).catch((err) => {
            assert.notCalled(webex.request);
            assert.equal(err.message, `API rate limited ${identityURL}/horse/v1/myID`);
          });
        });
        it('Does not reject idbroker request if API is not rate limited', () => {
          const options = {uri: `${idBrokerURL}/horse/v1/myID`};

          return interceptor.onRequest(options).then((result) => {
            assert.equal(result, options);
          });
        });
        it('Does not reject identity request if API is not rate limited', () => {
          const options = {uri: `${identityURL}/horse/v1/myID`};

          return interceptor.onRequest(options).then((result) => {
            assert.equal(result, options);
          });
        });
      });

      describe('#onResponseError', () => {
        const err429 = new WebexHttpError.TooManyRequests({
          statusCode: 429,
          options: {
            headers: {
              trackingid: 'test',
              'retry-after': 60
            },
            uri: `${idBrokerURL}/horse/v1/myID`
          },
          body: {
            error: 'Too Many Requests'
          }
        });
        const err429identity = new WebexHttpError.TooManyRequests({
          statusCode: 429,
          options: {
            headers: {
              trackingid: 'test',
              'retry-after': 60
            },
            uri: `${identityURL}/horse/v1/myID`
          },
          body: {
            error: 'Too Many Requests'
          }
        });
        const err429notIdBroker = new WebexHttpError.TooManyRequests({
          statusCode: 429,
          options: {
            headers: {
              trackingid: 'test',
              'retry-after': 60
            },
            uri: 'https://example.com/horse/v1/myID'
          },
          body: {
            error: 'Too Many Requests'
          }
        });
        const err404 = new WebexHttpError.BadRequest({
          statusCode: 404,
          options: {
            headers: {
              trackingid: 'test',
              'retry-after': 60
            },
            uri: `${idBrokerURL}/horse/v1/myID`
          },
          body: {
            error: 'Resource Not Found'
          }
        });
        const optionsIdBroker = {
          headers: {
            trackingid: 'test',
            'retry-after': 60
          },
          uri: `${idBrokerURL}/horse/v1/myID`
        };


        const optionsIdentity = {
          headers: {
            trackingid: 'test',
            'retry-after': 60
          },
          uri: `${identityURL}/horse/v1/myID`
        };

        const optionsNotIdBroker = {
          headers: {
            trackingid: 'test',
            'retry-after': 60
          },
          uri: 'https://example.com/horse/v1/myID'
        };

        it.skip('Stores API name and retry-after when status code is 429 and URI is idbroker', () => interceptor.onResponseError(optionsIdBroker, err429).catch((resp) => {
          assert.equal(interceptor.isRateLimited(`${idBrokerURL}/horse/v1/myID`), true);
          assert.equal(resp, err429);
        }));
        it.skip('Stores API name and retry-after when status code is 429 and URI is identity', () => interceptor.onResponseError(optionsIdentity, err429identity).catch((resp) => {
          assert.equal(interceptor.isRateLimited(`${identityURL}/horse/v1/myID`), true);
          assert.equal(resp, err429identity);
        }));
        it('Does not store API name and retry-after when URI is idbroker and status code is not 429', () => interceptor.onResponseError(optionsIdBroker, err404).catch((resp) => {
          assert.equal(interceptor.isRateLimited(`${idBrokerURL}/horse/v1/myID`), false);
          assert.equal(resp, err404);
        }));
        it('Does not store API name and retry-after when URI is identity and status code is not 429', () => interceptor.onResponseError(optionsIdentity, err404).catch((resp) => {
          assert.equal(interceptor.isRateLimited(`${identityURL}/horse/v1/myID`), false);
          assert.equal(resp, err404);
        }));
        it('Does not store API name and retry-after when status is 429 and URI is not idbroker', () => interceptor.onResponseError(optionsNotIdBroker, err429notIdBroker).catch((resp) => {
          assert.equal(interceptor.isRateLimited('https://example.com/horse/v1/myID'), false);
          assert.equal(resp, err429notIdBroker);
        }));
      });
    });
  });
});

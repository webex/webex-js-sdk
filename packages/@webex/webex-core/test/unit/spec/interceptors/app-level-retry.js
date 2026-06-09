/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import FakeTimers from '@sinonjs/fake-timers';
import sinon from 'sinon';
import {AppLevelRetryInterceptor, config, WebexHttpError} from '@webex/webex-core';
import {cloneDeep} from 'lodash';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('AppLevelRetryInterceptor', () => {
      let clock, interceptor, webex;

      const createReason = ({statusCode = 429, headers = {}, retryAfter, uri, method = 'GET'} = {}) => {
        const ErrorConstructor =
          statusCode === 503 ? WebexHttpError.ServiceUnavailable : WebexHttpError.TooManyRequests;
        const reason = new ErrorConstructor({
          statusCode,
          headers,
          options: {
            headers: {
              trackingid: 'tracking-id',
            },
            method,
            uri: uri || 'https://example.webex.com/v1/resource',
          },
          body: {
            error: 'retryable error',
          },
        });

        if (retryAfter !== undefined) {
          Reflect.defineProperty(reason, 'retryAfter', {
            enumerable: true,
            value: retryAfter,
          });
        }

        return reason;
      };

      const createInterceptor = (appLevelRetry) => {
        webex = new MockWebex({
          config: {
            ...cloneDeep(config),
            appLevelRetry,
          },
        });
        webex.internal.services = {
          getServiceFromUrl: sinon.stub(),
        };
        interceptor = Reflect.apply(AppLevelRetryInterceptor.create, webex, []);
        clock = FakeTimers.install({now: Date.now()});
      };

      afterEach(() => {
        if (clock) {
          clock.uninstall();
        }
      });

      it('rejects retryable errors when SDK package defaults are disabled', () => {
        createInterceptor(undefined);

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason();

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      ['GET', 'POST', 'PUT'].forEach((method) => {
        it(`retries default-eligible ${method} requests when app-level retry is enabled`, () => {
          createInterceptor({enabled: true});
          webex.request.resolves({statusCode: 200});

          const options = {
            method,
            uri: 'https://example.webex.com/v1/resource',
          };
          const reason = createReason({
            headers: {
              'Retry-After': '1',
            },
            method,
          });
          const replay = interceptor.onResponseError(options, reason);

          clock.tick(999);
          assert.notCalled(webex.request);

          clock.tick(1);

          return replay.then((response) => {
            assert.calledOnce(webex.request);
            assert.calledWith(webex.request, options);
            assert.deepEqual(response, {statusCode: 200});
          });
        });
      });

      ['HEAD', 'OPTIONS'].forEach((method) => {
        it(`does not retry ${method} by default`, () => {
          createInterceptor({enabled: true});

          const options = {
            method,
            uri: 'https://example.webex.com/v1/resource',
          };
          const reason = createReason({method});

          return interceptor.onResponseError(options, reason).catch((error) => {
            assert.equal(error, reason);
            assert.notCalled(webex.request);
          });
        });
      });

      it('allows request policy to enable HEAD', () => {
        createInterceptor({enabled: true});
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'HEAD',
          retryPolicy: {
            methods: {
              HEAD: true,
            },
          },
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason({
          headers: {
            'retry-after': '0',
          },
          method: 'HEAD',
        });

        return interceptor.onResponseError(options, reason).then(() => {
          assert.calledOnce(webex.request);
        });
      });

      it('uses reason.retryAfter when response headers do not include Retry-After', () => {
        createInterceptor({enabled: true});
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason({
          retryAfter: '2',
          statusCode: 503,
        });
        const replay = interceptor.onResponseError(options, reason);

        clock.tick(1999);
        assert.notCalled(webex.request);

        clock.tick(1);

        return replay.then(() => {
          assert.calledOnce(webex.request);
        });
      });

      it('uses fallback delays when Retry-After is missing', async () => {
        createInterceptor({enabled: true});

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };

        webex.request.callsFake(() => interceptor.onResponseError(options, createReason()));

        const replay = interceptor.onResponseError(options, createReason()).catch((error) => error);

        await clock.tickAsync(399);
        assert.notCalled(webex.request);

        await clock.tickAsync(1);
        assert.calledOnce(webex.request);

        await clock.tickAsync(1599);
        assert.calledOnce(webex.request);

        await clock.tickAsync(1);
        assert.calledTwice(webex.request);

        await clock.tickAsync(3199);
        assert.calledTwice(webex.request);

        await clock.tickAsync(1);
        assert.calledThrice(webex.request);

        const error = await replay;

        assert.instanceOf(error, WebexHttpError.TooManyRequests);
      });

      it('rejects missing Retry-After when fallback is disabled', () => {
        createInterceptor({
          enabled: true,
          fallback: {
            enabled: false,
          },
        });

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason();

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      it('does not retry 429 when 429 handling is disabled', () => {
        createInterceptor({
          enabled: true,
          statuses: {
            429: false,
            503: true,
          },
        });

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason({
          headers: {
            'retry-after': '0',
          },
          statusCode: 429,
        });

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      it('does not retry 503 when 503 handling is disabled', () => {
        createInterceptor({
          enabled: true,
          statuses: {
            429: true,
            503: false,
          },
        });

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason({
          headers: {
            'retry-after': '0',
          },
          statusCode: 503,
        });

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      it('uses fallback delay when Retry-After handling is disabled', async () => {
        createInterceptor({
          enabled: true,
          fallback: {
            delays: [25],
          },
          maxRetries: 1,
          retryAfter: {
            enabled: false,
          },
        });
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const replay = interceptor.onResponseError(
          options,
          createReason({
            headers: {
              'retry-after': '1',
            },
          })
        );

        await clock.tickAsync(24);
        assert.notCalled(webex.request);

        await clock.tickAsync(1);

        await replay;
        assert.calledOnce(webex.request);
      });

      it('does not replay when maxRetries is zero', () => {
        createInterceptor({
          enabled: true,
          maxRetries: 0,
        });

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = createReason({
          headers: {
            'retry-after': '0',
          },
        });

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      it('rejects another eligible request while a matching retry is waiting', async () => {
        createInterceptor({enabled: true});
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'GET',
          service: 'meetingcontainers',
          uri: 'https://meetingcontainers.webex.com/v1/containers/1',
        };
        const secondOptions = {
          method: 'GET',
          service: 'meetingcontainers',
          uri: 'https://meetingcontainers.webex.com/v1/containers/2',
        };
        const reason = createReason({
          headers: {
            'retry-after': '1',
          },
          uri: options.uri,
        });

        const replay = interceptor.onResponseError(options, reason);

        await interceptor.onRequest(secondOptions).catch((error) => {
          assert.match(error.message, /API rate limited service:meetingcontainers/);
        });
        await clock.tickAsync(1000);
        await replay;
      });

      it('does not block a request that opts out while a matching retry is waiting', async () => {
        createInterceptor({enabled: true});
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'GET',
          service: 'meetingcontainers',
          uri: 'https://meetingcontainers.webex.com/v1/containers/1',
        };
        const optedOutOptions = {
          method: 'GET',
          retryPolicy: false,
          service: 'meetingcontainers',
          uri: 'https://meetingcontainers.webex.com/v1/containers/2',
        };
        const reason = createReason({
          headers: {
            'retry-after': '1',
          },
          uri: options.uri,
        });

        const replay = interceptor.onResponseError(options, reason);

        await interceptor.onRequest(optedOutOptions).then((result) => {
          assert.equal(result, optedOutOptions);
        });
        await clock.tickAsync(1000);
        await replay;
      });

      it('allows service policy to opt out when app-level retry is enabled', () => {
        createInterceptor({
          enabled: true,
          services: {
            metrics: false,
          },
        });

        const options = {
          method: 'POST',
          service: 'metrics',
          uri: 'https://metrics.webex.com/v1/events',
        };
        const reason = createReason({
          method: 'POST',
          uri: options.uri,
        });

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      it('allows service policy to enable retry when app-level retry is disabled', () => {
        createInterceptor({
          services: {
            u2c: {
              enabled: true,
            },
          },
        });
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'GET',
          service: 'u2c',
          uri: 'https://u2c.webex.com/u2c/api/v1/catalog',
        };
        const reason = createReason({
          headers: {
            'retry-after': '0',
          },
          uri: options.uri,
        });

        return interceptor.onResponseError(options, reason).then(() => {
          assert.calledOnce(webex.request);
        });
      });

      it('allows request policy to opt out when service retry is enabled', () => {
        createInterceptor({
          enabled: true,
          services: {
            meetingcontainers: {
              enabled: true,
            },
          },
        });

        const options = {
          method: 'GET',
          retryPolicy: false,
          service: 'meetingcontainers',
          uri: 'https://meetingcontainers.webex.com/v1/containers',
        };
        const reason = createReason({
          uri: options.uri,
        });

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });

      it('uses request policy to override fallback delays and retry budget', async () => {
        createInterceptor({enabled: true});

        const options = {
          method: 'GET',
          retryPolicy: {
            fallback: {
              delays: [25],
            },
            maxRetries: 1,
          },
          uri: 'https://example.webex.com/v1/resource',
        };

        webex.request.callsFake(() => interceptor.onResponseError(options, createReason()));

        const replay = interceptor.onResponseError(options, createReason()).catch((error) => error);

        await clock.tickAsync(24);
        assert.notCalled(webex.request);

        await clock.tickAsync(1);
        assert.calledOnce(webex.request);

        const error = await replay;

        assert.instanceOf(error, WebexHttpError.TooManyRequests);
      });

      it('matches service policy through service catalog lookup', () => {
        createInterceptor({
          services: {
            meetingcontainers: {
              enabled: true,
            },
          },
        });
        webex.internal.services.getServiceFromUrl.returns({name: 'meetingcontainers'});
        webex.request.resolves({statusCode: 200});

        const options = {
          method: 'GET',
          uri: 'https://catalog.example.com/v1/containers',
        };
        const reason = createReason({
          headers: {
            'retry-after': '0',
          },
          uri: options.uri,
        });

        return interceptor.onResponseError(options, reason).then(() => {
          assert.calledOnce(webex.internal.services.getServiceFromUrl);
          assert.calledOnce(webex.request);
        });
      });

      it('does not retry unsupported statuses', () => {
        createInterceptor({enabled: true});

        const options = {
          method: 'GET',
          uri: 'https://example.webex.com/v1/resource',
        };
        const reason = new WebexHttpError.InternalServerError({
          statusCode: 500,
          headers: {
            'retry-after': '0',
          },
          options: {
            headers: {
              trackingid: 'tracking-id',
            },
            method: 'GET',
            uri: options.uri,
          },
          body: {
            error: 'server error',
          },
        });

        return interceptor.onResponseError(options, reason).catch((error) => {
          assert.equal(error, reason);
          assert.notCalled(webex.request);
        });
      });
    });
  });
});

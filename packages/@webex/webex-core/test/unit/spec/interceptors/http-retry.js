/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import FakeTimers from '@sinonjs/fake-timers';
import sinon from 'sinon';
import {
  getHttpRetryDelay,
  parseRetryAfter,
  resolveHttpRetryPolicy,
} from '../../../../src/interceptors/http-retry';
import HttpRetryInterceptor from '../../../../src/interceptors/http-retry';
import config from '../../../../src/config';
import {cloneDeep} from 'lodash';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('HttpRetryInterceptor', () => {
      let clock;
      let interceptor;
      let webex;

      const reason = (statusCode, retryAfter) => ({
        headers: retryAfter === undefined ? {} : {'retry-after': retryAfter},
        statusCode,
      });

      const createInterceptor = (httpRetry) => {
        clock?.uninstall();
        webex = new MockWebex({
          config: {
            ...cloneDeep(config),
            httpRetry,
          },
        });
        webex.internal.services = {
          getServiceFromUrl: sinon.stub(),
        };
        interceptor = Reflect.apply(HttpRetryInterceptor.create, webex, []);
        clock = FakeTimers.install({now: Date.UTC(2026, 0, 1)});
      };

      const enable = (overrides = {}) => ({
        default: {
          enabled: true,
          backoff: {
            jitterRatio: 0,
          },
          ...overrides,
        },
        services: {},
      });

      const replay = async (options, error, delay) => {
        webex.request.resolves({statusCode: 200});
        const response = interceptor.onResponseError(options, error);

        if (delay > 0) {
          await clock.tickAsync(delay - 1);
          assert.notCalled(webex.request);
          await clock.tickAsync(1);
        } else {
          await clock.tickAsync(0);
        }

        return response;
      };

      const rejectsWith = async (promise, expected) => {
        try {
          await promise;
          assert.fail('Expected promise to be rejected');
        } catch (error) {
          assert.equal(error, expected);
        }
      };

      afterEach(() => {
        clock?.uninstall();
      });

      it('is disabled by SDK defaults', async () => {
        createInterceptor(config.httpRetry);
        const error = reason(429, '0');

        await rejectsWith(
          interceptor.onResponseError({method: 'GET', uri: 'https://example.com/items'}, error),
          error
        );
        assert.notCalled(webex.request);
      });

      ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].forEach((method) => {
        it(`retries the default ${method} method`, async () => {
          createInterceptor(enable());
          const options = {method, uri: 'https://example.com/items'};

          await replay(options, reason(503, '1'), 1000);

          assert.calledOnceWithExactly(webex.request, options);
          assert.equal(options.$httpRetryCount, 1);
        });
      });

      it('requires POST to be opted in', async () => {
        createInterceptor(enable());
        const error = reason(429, '0');

        await rejectsWith(
          interceptor.onResponseError({method: 'POST', uri: 'https://example.com/items'}, error),
          error
        );
        assert.notCalled(webex.request);
      });

      it('uses a service override to opt POST in', async () => {
        createInterceptor({
          ...enable(),
          services: {
            'meeting-container': {
              methods: ['GET', 'POST'],
            },
          },
        });
        const options = {
          method: 'POST',
          service: 'meeting-container',
          uri: 'https://example.com/containers',
        };

        await replay(options, reason(429, '0'), 0);
        assert.calledOnceWithExactly(webex.request, options);
      });

      it('parses Retry-After seconds and HTTP dates', () => {
        const now = Date.UTC(2026, 0, 1);

        assert.equal(parseRetryAfter('1.5', now), 1500);
        assert.equal(parseRetryAfter(new Date(now + 2000).toUTCString(), now), 2000);
        assert.isUndefined(parseRetryAfter('not-a-date', now));
      });

      it('does not shorten Retry-After values above the configured maximum', async () => {
        createInterceptor(enable({retryAfter: {maxDelay: 999}}));
        const error = reason(429, '1');

        await rejectsWith(
          interceptor.onResponseError({method: 'GET', uri: 'https://example.com/items'}, error),
          error
        );
        assert.notCalled(webex.request);
      });

      it('falls back to exponential backoff for configured transient failures', async () => {
        createInterceptor(enable());
        const options = {method: 'GET', uri: 'https://example.com/items'};
        const error = reason(500);

        webex.request.callsFake(() => interceptor.onResponseError(options, error));
        const result = interceptor.onResponseError(options, error).catch((caught) => caught);

        await clock.tickAsync(399);
        assert.notCalled(webex.request);
        await clock.tickAsync(1);
        assert.calledOnce(webex.request);
        await clock.tickAsync(800);
        assert.calledTwice(webex.request);
        await clock.tickAsync(1600);
        assert.calledThrice(webex.request);

        assert.equal(await result, error);
        assert.equal(options.$httpRetryCount, 3);
      });

      it('applies bounded jitter to exponential backoff', () => {
        const policy = resolveHttpRetryPolicy({
          config: enable({backoff: {initialDelay: 100, jitterRatio: 0.2}}),
        });
        const options = {method: 'GET'};

        assert.equal(
          getHttpRetryDelay({options, policy, random: () => 0, reason: reason(500)}),
          80
        );
        assert.equal(
          getHttpRetryDelay({options, policy, random: () => 1, reason: reason(500)}),
          120
        );
      });

      it('only retries network failures when explicitly configured', async () => {
        createInterceptor(enable());
        const networkError = new TypeError('Failed to fetch');

        await rejectsWith(
          interceptor.onResponseError(
            {method: 'GET', uri: 'https://example.com/items'},
            networkError
          ),
          networkError
        );
        assert.notCalled(webex.request);

        createInterceptor(enable({retryNetworkErrors: true}));
        await replay(
          {method: 'GET', uri: 'https://example.com/items'},
          new TypeError('Failed to fetch'),
          400
        );
        assert.calledOnce(webex.request);
      });

      it('does not retry unconfigured statuses', async () => {
        createInterceptor(enable());
        const error = reason(400);

        await rejectsWith(
          interceptor.onResponseError({method: 'GET', uri: 'https://example.com/items'}, error),
          error
        );
        assert.notCalled(webex.request);
      });

      it('keeps the retry count independent from authentication replayCount', async () => {
        createInterceptor(enable());
        const options = {
          method: 'GET',
          replayCount: 1,
          uri: 'https://example.com/items',
        };

        await replay(options, reason(429, '0'), 0);

        assert.equal(options.$httpRetryCount, 1);
        assert.equal(options.replayCount, 1);
      });

      it('honors both request-level opt-out mechanisms', async () => {
        createInterceptor(enable());
        const error = reason(429, '0');

        for (const options of [
          {httpRetry: false, method: 'GET', uri: 'https://example.com/items'},
          {method: 'GET', skipRetries: true, uri: 'https://example.com/items'},
        ]) {
          await interceptor.onRequest(options);
          await rejectsWith(interceptor.onResponseError(options, error), error);
        }

        assert.notCalled(webex.request);
      });

      it('does not replay stream and reader bodies', async () => {
        createInterceptor(enable({methods: ['POST']}));
        const error = reason(503, '0');

        for (const body of [{getReader() {}}, {pipe() {}}, {read() {}, releaseLock() {}}]) {
          await rejectsWith(
            interceptor.onResponseError(
              {body, method: 'POST', uri: 'https://example.com/items'},
              error
            ),
            error
          );
        }

        assert.notCalled(webex.request);
      });

      it('aborts a pending backoff without replaying', async () => {
        createInterceptor(enable());
        const controller = new AbortController();
        const pending = interceptor.onResponseError(
          {method: 'GET', signal: controller.signal, uri: 'https://example.com/items'},
          reason(500)
        );

        controller.abort();

        await assert.isRejected(pending, /aborted/i);
        assert.notCalled(webex.request);
      });

      it('resolves default, path, service, service-path, and request policies in order', () => {
        const policy = resolveHttpRetryPolicy({
          config: {
            default: {
              enabled: true,
              methods: ['GET', 'PUT'],
              paths: [
                {match: {prefixes: ['/v1/']}, policy: {maxRetries: 2}},
                {match: {exact: ['/v1/items/sync']}, policy: {retryNetworkErrors: true}},
              ],
            },
            services: {
              locus: {
                methods: ['POST'],
                paths: [{match: {suffixes: ['/sync']}, policy: {enabled: false}}],
              },
            },
          },
          requestPolicy: {enabled: true, maxRetries: 1},
          serviceName: 'LOCUS',
          uri: 'https://locus.example.com/v1/items/sync?sequence=1',
        });

        assert.deepEqual(policy.methods, ['POST']);
        assert.equal(policy.retryNetworkErrors, true);
        assert.equal(policy.enabled, true);
        assert.equal(policy.maxRetries, 1);
        assert.notProperty(policy, 'paths');
      });

      it('uses catalog service names and stores the resolved policy on the request', async () => {
        createInterceptor({
          default: {enabled: false},
          services: {locus: {enabled: true}},
        });
        webex.internal.services.getServiceFromUrl.returns({name: 'LOCUS'});
        const options = {method: 'GET', uri: 'https://catalog.example.com/v1/items'};

        await interceptor.onRequest(options);

        assert.calledOnceWithExactly(webex.internal.services.getServiceFromUrl, options.uri);
        assert.equal(options.$httpRetryPolicy.enabled, true);
      });
    });
  });
});

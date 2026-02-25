import 'jsdom-global/register';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {WebexHttpError} from '@webex/webex-core';
import DataChannelAuthTokenInterceptor from '@webex/plugin-meetings/src/interceptors/dataChannelAuthToken';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY} from '@webex/plugin-meetings/src/interceptors/constant';

describe('plugin-meetings', () => {
  describe('Interceptors', () => {
    describe('DataChannelAuthTokenInterceptor', () => {
      let interceptor, webex, clock;

      beforeEach(() => {
        clock = sinon.useFakeTimers();

        webex = new MockWebex({children: {}});
        webex.request = sinon.stub().resolves({});

        interceptor = Reflect.apply(DataChannelAuthTokenInterceptor.create, webex, []);

        interceptor._refreshDataChannelToken = sinon.stub();
        interceptor._isDataChannelTokenEnabled = sinon.stub().resolves(true);
      });

      afterEach(() => {
        clock.restore();
      });

      const makeReason = (statusCode) =>
        new WebexHttpError({
          statusCode,
          options: {headers: {}, uri: 'https://example.com'},
          body: {},
        });

      describe('#onResponseError', () => {
        it('rejects when no Data-Channel-Auth-Token header exists', async () => {
          const options = {headers: {}};
          const reason = makeReason(401);

          await assert.isRejected(interceptor.onResponseError(options, reason), reason);
        });

        it('rejects when statusCode is not 401/403', async () => {
          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'abc'}};
          const reason = makeReason(500);

          await assert.isRejected(interceptor.onResponseError(options, reason), reason);
        });

        it('rejects when retry count exceeds MAX_RETRY', async () => {
          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'abc'}};
          const reason = makeReason(401);

          for (let i = 0; i < MAX_RETRY; i++) {
            interceptor.onResponseError(options, reason).catch(() => {});
          }

          await assert.isRejected(interceptor.onResponseError(options, reason), reason);

          sinon.assert.calledOnce(LoggerProxy.logger.error);
        });

        it('calls refreshTokenAndRetryWithDelay when eligible', async () => {
          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'abc'}};
          const reason = makeReason(401);

          interceptor._isDataChannelTokenEnabled.resolves(true);

          const stub = sinon.stub(interceptor, 'refreshTokenAndRetryWithDelay').resolves('ok');

          await interceptor.onResponseError(options, reason);

          sinon.assert.calledOnceWithExactly(stub, options);
        });

        it('rejects when isDataChannelTokenEnabled is false', async () => {
          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'abc'}};
          const reason = makeReason(401);

          interceptor._isDataChannelTokenEnabled.resolves(false);

          await assert.isRejected(interceptor.onResponseError(options, reason), reason);
        });
      });

      describe('#refreshTokenAndRetryWithDelay', () => {
        const options = {
          headers: {[DATA_CHANNEL_AUTH_HEADER]: 'old-token'},
          method: 'GET',
          uri: 'https://example.com',
        };

        it('refreshes token and retries request successfully', async () => {
          interceptor._refreshDataChannelToken.resolves('new-token');
          webex.request.resolves('mock-response');

          const promise = interceptor.refreshTokenAndRetryWithDelay(options);

          clock.tick(2000);

          const result = await promise;

          expect(interceptor._refreshDataChannelToken.calledOnce).to.be.true;
          expect(options.headers[DATA_CHANNEL_AUTH_HEADER]).to.equal('new-token');
          expect(webex.request.calledOnceWith(options)).to.be.true;
          expect(result).to.equal('mock-response');
        });

        it('rejects when refreshDataChannelToken fails', async () => {
          interceptor._refreshDataChannelToken.rejects(new Error('refresh failed'));

          const promise = interceptor.refreshTokenAndRetryWithDelay(options);

          clock.tick(2000);

          await assert.isRejected(
            promise,
            /DataChannel token refresh failed: refresh failed/
          );
        });

        it('rejects when retry request fails', async () => {
          interceptor._refreshDataChannelToken.resolves('new-token');
          webex.request.rejects(new Error('request failed'));

          const promise = interceptor.refreshTokenAndRetryWithDelay(options);

          clock.tick(2000);

          await assert.isRejected(
            promise,
            /DataChannel token refresh failed: request failed/
          );
        });
      });
    });
  });
});

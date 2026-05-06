import 'jsdom-global/register';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {WebexHttpError} from '@webex/webex-core';
import DataChannelAuthTokenInterceptor from '@webex/plugin-meetings/src/interceptors/dataChannelAuthToken';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import * as utils from '@webex/plugin-meetings/src/interceptors/utils';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY} from '@webex/plugin-meetings/src/interceptors/constant';
import {LLM_PRACTICE_SESSION, LLM_DEFAULT_SESSION, LOCUS_URL} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings', () => {
  describe('Interceptors', () => {
    describe('DataChannelAuthTokenInterceptor', () => {
      let interceptor, webex, clock;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
        sinon.stub(LoggerProxy, 'logger').value({
          error: sinon.stub(),
          warn: sinon.stub(),
        });

        webex = new MockWebex({children: {}});
        webex.request = sinon.stub().resolves({});

        interceptor = Reflect.apply(DataChannelAuthTokenInterceptor.create, webex, []);

        interceptor._refreshDataChannelToken = sinon.stub();
        interceptor._isDataChannelTokenEnabled = sinon.stub().resolves(true);
      });

      afterEach(() => {
        sinon.restore();
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

      describe('#onRequest', () => {
        let isJwtTokenExpiredStub;

        beforeEach(() => {
          isJwtTokenExpiredStub = sinon.stub(utils, 'isJwtTokenExpired').returns(false);
        });

        it('does nothing when token is missing', async () => {
          const options = {headers: {}};

          const res = await interceptor.onRequest(options);

          expect(res).to.equal(options);
          sinon.assert.notCalled(isJwtTokenExpiredStub);
        });

        it('does nothing when feature is disabled', async () => {
          interceptor._isDataChannelTokenEnabled.resolves(false);

          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'old-token'}};
          const res = await interceptor.onRequest(options);

          expect(res).to.equal(options);
          sinon.assert.notCalled(isJwtTokenExpiredStub);
        });

        it('does not refresh when token is not expired', async () => {
          interceptor._isDataChannelTokenEnabled.resolves(true);
          isJwtTokenExpiredStub.returns(false);

          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'old-token'}};
          const res = await interceptor.onRequest(options);

          sinon.assert.notCalled(interceptor._refreshDataChannelToken);
          expect(res.headers[DATA_CHANNEL_AUTH_HEADER]).to.equal('old-token');
        });

        it('refreshes token when expired', async () => {
          interceptor._isDataChannelTokenEnabled.resolves(true);
          isJwtTokenExpiredStub.returns(true);

          interceptor._refreshDataChannelToken.resolves('new-token');

          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'old-token'}};
          const res = await interceptor.onRequest(options);

          sinon.assert.calledOnce(interceptor._refreshDataChannelToken);
          expect(res.headers[DATA_CHANNEL_AUTH_HEADER]).to.equal('new-token');
        });

        it('continues request when refresh fails', async () => {
          interceptor._isDataChannelTokenEnabled.resolves(true);
          isJwtTokenExpiredStub.returns(true);

          interceptor._refreshDataChannelToken.rejects(new Error('refresh failed'));

          const options = {headers: {[DATA_CHANNEL_AUTH_HEADER]: 'old-token'}};
          const res = await interceptor.onRequest(options);

          expect(res.headers[DATA_CHANNEL_AUTH_HEADER]).to.equal('old-token');
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

        it('passes request URL to _refreshDataChannelToken', async () => {
          const psOptions = {
            headers: {[DATA_CHANNEL_AUTH_HEADER]: 'old-token'},
            method: 'POST',
            uri: 'https://locus.example.com/practiceSession/datachannel',
          };

          interceptor._refreshDataChannelToken.resolves('new-token');
          webex.request.resolves('mock-response');

          const promise = interceptor.refreshTokenAndRetryWithDelay(psOptions);

          clock.tick(2000);

          await promise;

          sinon.assert.calledOnceWithExactly(
            interceptor._refreshDataChannelToken,
            psOptions.uri
          );
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

      describe('refreshDataChannelToken routing (factory dispatcher)', () => {
        let llmMock;
        let meetingA;
        let meetingsMock;
        let dispatcherInterceptor;

        const PS_DATACHANNEL_URL = 'https://board-a.wbx2.com/datachannel/api/v1/locus/cHJhY3RpY2Vfc2Vzc2lvbl9sb2N1cw==/registrations';
        const DEFAULT_DATACHANNEL_URL = 'https://board-a.wbx2.com/datachannel/api/v1/locus/aHR0cHM6Ly9sb2N1cy1hLndieDIuY29t/registrations';

        beforeEach(() => {
          meetingA = {
            refreshDataChannelToken: sinon.stub().resolves({
              body: {datachannelToken: 'token-from-meeting-a', dataChannelTokenType: 'PracticeSession'},
            }),
          };

          llmMock = {
            isDataChannelTokenEnabled: sinon.stub().resolves(true),
            getLocusUrl: sinon.stub(),
            getDatachannelUrl: sinon.stub(),
            refreshDataChannelToken: sinon.stub().resolves({
              body: {datachannelToken: 'token-from-llm-fallback', dataChannelTokenType: 'Default'},
            }),
            setDatachannelToken: sinon.stub(),
          };

          meetingsMock = {
            getMeetingByType: sinon.stub(),
          };

          const context = {
            internal: {llm: llmMock},
            meetings: meetingsMock,
          };

          dispatcherInterceptor = Reflect.apply(DataChannelAuthTokenInterceptor.create, context, []);
        });

        it('routes PS request URL to PS-owning Meeting', async () => {
          llmMock.getDatachannelUrl.withArgs(LLM_PRACTICE_SESSION).returns(PS_DATACHANNEL_URL);
          llmMock.getDatachannelUrl.withArgs(LLM_DEFAULT_SESSION).returns(DEFAULT_DATACHANNEL_URL);
          llmMock.getLocusUrl.withArgs(LLM_PRACTICE_SESSION).returns('https://locus-a.example.com');
          meetingsMock.getMeetingByType.withArgs(LOCUS_URL, 'https://locus-a.example.com').returns(meetingA);

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-meeting-a');
          sinon.assert.calledOnceWithExactly(meetingA.refreshDataChannelToken);
          sinon.assert.notCalled(llmMock.refreshDataChannelToken);
          sinon.assert.calledOnceWithExactly(llmMock.setDatachannelToken, 'token-from-meeting-a', 'PracticeSession');
        });

        it('routes non-PS URL to default-session-owning Meeting', async () => {
          const meetingB = {
            refreshDataChannelToken: sinon.stub().resolves({
              body: {datachannelToken: 'token-from-meeting-b', dataChannelTokenType: 'Default'},
            }),
          };

          llmMock.getDatachannelUrl.withArgs(LLM_PRACTICE_SESSION).returns(PS_DATACHANNEL_URL);
          llmMock.getDatachannelUrl.withArgs(LLM_DEFAULT_SESSION).returns(DEFAULT_DATACHANNEL_URL);
          llmMock.getLocusUrl.withArgs(LLM_DEFAULT_SESSION).returns('https://locus-b.example.com');
          meetingsMock.getMeetingByType.withArgs(LOCUS_URL, 'https://locus-b.example.com').returns(meetingB);

          const token = await dispatcherInterceptor._refreshDataChannelToken(DEFAULT_DATACHANNEL_URL);

          expect(token).to.equal('token-from-meeting-b');
          sinon.assert.calledOnceWithExactly(meetingB.refreshDataChannelToken);
          sinon.assert.notCalled(llmMock.refreshDataChannelToken);
          sinon.assert.calledOnceWithExactly(llmMock.setDatachannelToken, 'token-from-meeting-b', 'Default');
        });

        it('falls back to LLM singleton when no Meeting matches locusUrl', async () => {
          llmMock.getDatachannelUrl.withArgs(LLM_PRACTICE_SESSION).returns(PS_DATACHANNEL_URL);
          llmMock.getDatachannelUrl.withArgs(LLM_DEFAULT_SESSION).returns(DEFAULT_DATACHANNEL_URL);
          llmMock.getLocusUrl.withArgs(LLM_PRACTICE_SESSION).returns('https://locus-unknown.example.com');
          meetingsMock.getMeetingByType.returns(undefined);

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-llm-fallback');
          sinon.assert.calledOnceWithExactly(llmMock.refreshDataChannelToken);
          sinon.assert.calledOnceWithExactly(llmMock.setDatachannelToken, 'token-from-llm-fallback', 'Default');
        });

        it('falls back to LLM singleton when LLM has no locusUrl for session', async () => {
          llmMock.getDatachannelUrl.withArgs(LLM_PRACTICE_SESSION).returns(undefined);
          llmMock.getDatachannelUrl.withArgs(LLM_DEFAULT_SESSION).returns(undefined);
          llmMock.getLocusUrl.withArgs(LLM_DEFAULT_SESSION).returns(undefined);

          const token = await dispatcherInterceptor._refreshDataChannelToken(
            'https://unknown-datachannel.example.com/registrations'
          );

          expect(token).to.equal('token-from-llm-fallback');
          sinon.assert.calledOnceWithExactly(llmMock.refreshDataChannelToken);
        });
      });
    });
  });
});

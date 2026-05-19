import 'jsdom-global/register';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {WebexHttpError} from '@webex/webex-core';
import DataChannelAuthTokenInterceptor from '@webex/plugin-meetings/src/interceptors/dataChannelAuthToken';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import * as utils from '@webex/plugin-meetings/src/interceptors/utils';
import {DATA_CHANNEL_AUTH_HEADER, MAX_RETRY} from '@webex/plugin-meetings/src/interceptors/constant';
import {LOCUS_URL} from '@webex/plugin-meetings/src/constants';

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
            id: 'meeting-a',
            refreshDataChannelToken: sinon.stub().resolves({
              body: {
                datachannelToken: 'token-from-meeting-a',
                dataChannelTokenType: 'llm-practice-session',
              },
            }),
          };

          llmMock = {
            isDataChannelTokenEnabled: sinon.stub().resolves(true),
            getSessionIdByDatachannelUrl: sinon.stub(),
            getLocusUrlByDatachannelUrl: sinon.stub(),
            getOwnerMeetingId: sinon.stub().returns(undefined),
            refreshDataChannelToken: sinon.stub().resolves({
              body: {
                datachannelToken: 'token-from-llm-fallback',
                dataChannelTokenType: 'llm-default-session',
              },
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

        it('routes PS request URL to PS session handler', async () => {
          llmMock.getSessionIdByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns('llm-practice-session');
          llmMock.refreshDataChannelToken
            .withArgs('llm-practice-session')
            .resolves({
              body: {
                datachannelToken: 'token-from-ps-session',
                dataChannelTokenType: 'llm-practice-session',
              },
            });

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-ps-session');
          sinon.assert.calledOnceWithExactly(llmMock.refreshDataChannelToken, 'llm-practice-session');
          sinon.assert.calledOnceWithExactly(
            llmMock.setDatachannelToken,
            'token-from-ps-session',
            'llm-practice-session',
            undefined
          );
        });

        it('routes non-PS URL to default session handler', async () => {
          llmMock.getSessionIdByDatachannelUrl.withArgs(DEFAULT_DATACHANNEL_URL).returns('llm-default-session');
          llmMock.refreshDataChannelToken
            .withArgs('llm-default-session')
            .resolves({
              body: {
                datachannelToken: 'token-from-default-session',
                dataChannelTokenType: 'llm-default-session',
              },
            });

          const token = await dispatcherInterceptor._refreshDataChannelToken(DEFAULT_DATACHANNEL_URL);

          expect(token).to.equal('token-from-default-session');
          sinon.assert.calledOnceWithExactly(llmMock.refreshDataChannelToken, 'llm-default-session');
          sinon.assert.calledOnceWithExactly(
            llmMock.setDatachannelToken,
            'token-from-default-session',
            'llm-default-session',
            undefined
          );
        });

        it('falls back to default refresh when URL does not match any session or meeting route', async () => {
          llmMock.getSessionIdByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns(undefined);
          llmMock.getLocusUrlByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns(undefined);
          llmMock.refreshDataChannelToken.withArgs(undefined).resolves({
            body: {
              datachannelToken: 'token-from-default-fallback',
              dataChannelTokenType: 'llm-default-session',
            },
          });

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-default-fallback');
          sinon.assert.calledOnceWithExactly(llmMock.refreshDataChannelToken, undefined);
          sinon.assert.calledOnceWithExactly(
            llmMock.setDatachannelToken,
            'token-from-default-fallback',
            'llm-default-session',
            undefined
          );
        });

        it('falls back to meeting lookup by locusUrl when session cannot be resolved', async () => {
          llmMock.getSessionIdByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns(undefined);
          llmMock.getLocusUrlByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns('https://locus-a.example.com');
          meetingsMock.getMeetingByType.withArgs(LOCUS_URL, 'https://locus-a.example.com').returns(meetingA);

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-meeting-a');
          sinon.assert.calledOnceWithExactly(meetingA.refreshDataChannelToken);
          sinon.assert.notCalled(llmMock.refreshDataChannelToken);
          sinon.assert.calledOnceWithExactly(
            llmMock.setDatachannelToken,
            'token-from-meeting-a',
            'llm-practice-session',
            'meeting-a'
          );
        });

        it('falls back to active meeting datachannel URL lookup when session/locus routing is unavailable', async () => {
          llmMock.getSessionIdByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns(undefined);
          llmMock.getLocusUrlByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns(undefined);
          meetingsMock.getAllMeetings = sinon.stub().returns({
            'meeting-a': {
              ...meetingA,
              locusInfo: {
                info: {
                  practiceSessionDatachannelUrl: PS_DATACHANNEL_URL,
                  datachannelUrl: DEFAULT_DATACHANNEL_URL,
                },
              },
            },
          });

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-meeting-a');
          sinon.assert.calledOnceWithExactly(meetingA.refreshDataChannelToken);
          sinon.assert.notCalled(llmMock.refreshDataChannelToken);
          sinon.assert.calledOnceWithExactly(
            llmMock.setDatachannelToken,
            'token-from-meeting-a',
            'llm-practice-session',
            'meeting-a'
          );
        });

        it('throws when refresh returns no payload', async () => {
          llmMock.getSessionIdByDatachannelUrl.returns('llm-default-session');
          llmMock.refreshDataChannelToken.withArgs('llm-default-session').resolves(null);

          await assert.isRejected(
            dispatcherInterceptor._refreshDataChannelToken(
              'https://unknown-datachannel.example.com/registrations'
            ),
            /DataChannel token refresh returned no payload/
          );
        });
      });
    });
  });
});

import 'jsdom-global/register';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {WebexHttpError} from '@webex/webex-core';
import DataChannelAuthTokenInterceptor from '@webex/plugin-meetings/src/interceptors/dataChannelAuthToken';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import * as utils from '@webex/plugin-meetings/src/interceptors/utils';
import {
  DATA_CHANNEL_AUTH_HEADER,
  MAX_RETRY,
} from '@webex/plugin-meetings/src/interceptors/constant';

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
            setLLMChannelDataToken: sinon.stub(),
          };

          llmMock = {
            isDataChannelTokenEnabled: sinon.stub().resolves(true),
            getChannelByDatachannelUrl: sinon.stub().returns(undefined),
          };

          meetingsMock = {
            getAllMeetings: sinon.stub().returns({}),
          };

          const context = {
            internal: {llm: llmMock},
            meetings: meetingsMock,
          };

          dispatcherInterceptor = Reflect.apply(DataChannelAuthTokenInterceptor.create, context, []);
        });

        it('routes request URL to matching channel', async () => {
          const mockChannel = {
            refreshDataChannelToken: sinon.stub().resolves({
              body: {
                datachannelToken: 'token-from-channel',
                dataChannelTokenType: 'llm-practice-session',
              },
            }),
            setDatachannelToken: sinon.stub(),
          };
          llmMock.getChannelByDatachannelUrl.withArgs(PS_DATACHANNEL_URL).returns(mockChannel);

          const token = await dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL);

          expect(token).to.equal('token-from-channel');
          sinon.assert.calledOnceWithExactly(
            llmMock.getChannelByDatachannelUrl,
            PS_DATACHANNEL_URL
          );
          sinon.assert.calledOnceWithExactly(mockChannel.refreshDataChannelToken);
          sinon.assert.calledOnceWithExactly(mockChannel.setDatachannelToken, 'token-from-channel');
        });

        it('falls back to meeting lookup when no channel matches', async () => {
          llmMock.getChannelByDatachannelUrl.returns(undefined);

          // Import the static method for matching datachannel URLs
          const LLMChannel = require('@webex/internal-plugin-llm').default;
          sinon
            .stub(LLMChannel, 'matchesDatachannelRequestUrl')
            .callsFake((requestUrl, datachannelUrl) => {
              return requestUrl === PS_DATACHANNEL_URL && datachannelUrl === PS_DATACHANNEL_URL;
            });

          meetingsMock.getAllMeetings.returns({
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
          sinon.assert.calledOnceWithExactly(
            meetingA.setLLMChannelDataToken,
            'token-from-meeting-a'
          );

          LLMChannel.matchesDatachannelRequestUrl.restore();
        });

        it('throws when no channel or meeting matches', async () => {
          llmMock.getChannelByDatachannelUrl.returns(undefined);
          meetingsMock.getAllMeetings.returns({});

          await assert.isRejected(
            dispatcherInterceptor._refreshDataChannelToken(
              'https://unknown-datachannel.example.com/registrations'
            ),
            /No LLM channel or meeting found for request URL/
          );
        });

        it('throws when channel refresh returns no payload', async () => {
          const mockChannel = {
            refreshDataChannelToken: sinon.stub().resolves(null),
            setDatachannelToken: sinon.stub(),
          };
          llmMock.getChannelByDatachannelUrl.returns(mockChannel);

          await assert.isRejected(
            dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL),
            /DataChannel token refresh returned no payload/
          );
        });

        it('throws when meeting refresh returns no payload', async () => {
          llmMock.getChannelByDatachannelUrl.returns(undefined);

          const LLMChannel = require('@webex/internal-plugin-llm').default;
          sinon.stub(LLMChannel, 'matchesDatachannelRequestUrl').returns(true);

          const meetingWithNoPayload = {
            id: 'meeting-b',
            refreshDataChannelToken: sinon.stub().resolves(null),
            setLLMChannelDataToken: sinon.stub(),
          };

          meetingsMock.getAllMeetings.returns({
            'meeting-b': {
              ...meetingWithNoPayload,
              locusInfo: {
                info: {
                  datachannelUrl: PS_DATACHANNEL_URL,
                },
              },
            },
          });

          await assert.isRejected(
            dispatcherInterceptor._refreshDataChannelToken(PS_DATACHANNEL_URL),
            /DataChannel token refresh returned no payload/
          );

          LLMChannel.matchesDatachannelRequestUrl.restore();
        });
      });
    });
  });
});

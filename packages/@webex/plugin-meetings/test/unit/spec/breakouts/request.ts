import sinon from 'sinon';
import {assert, expect} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import BreakoutRequest from "@webex/plugin-meetings/src/breakouts/request";
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';

describe('plugin-meetings', () => {
  describe('BreakoutRequest', () => {
    let webex;
    let breakoutRequest;
    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      // @ts-ignore
      breakoutRequest = new BreakoutRequest({webex});
      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
    });

    describe('#broadcast', () => {
      it('makes request as expected', async () => {
        let result = await breakoutRequest.broadcast({url: 'url', message: 'hello', groupId: 'groupId'});
        assert.calledWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/message',
          body: {
            message: 'hello',
            groups: [{
              id: 'groupId',
              recipientRoles: undefined,
              sessions: undefined
            }],
          }
        });
        assert.equal(result, 'REQUEST_RETURN_VALUE');

        result = await breakoutRequest.broadcast({
          url: 'url',
          message: 'hello',
          groupId: 'groupId',
          options: {
            presenters: true,
            cohosts: true
          }
        });
        assert.calledWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/message',
          body: {
            message: 'hello',
            groups: [{
              id: 'groupId',
              recipientRoles: ['COHOST', 'PRESENTER'],
              sessions: undefined
            }]
          }
        });
        assert.equal(result, 'REQUEST_RETURN_VALUE');

        result = await breakoutRequest.broadcast({
          url: 'url',
          message: 'hello',
          groupId: 'groupId',
          options: {
            presenters: true,
            cohosts: true
          },
          sessionId: 'sessionId'
        });

        assert.calledWithExactly(webex.request, {
          method: 'POST',
          uri: 'url/message',
          body: {
            message: 'hello',
            groups: [{
              id: 'groupId',
              recipientRoles: ['COHOST', 'PRESENTER'],
              sessions: [{id: 'sessionId'}]
            }]
          }
        });
        assert.equal(result, 'REQUEST_RETURN_VALUE');
      });

      it('catch 409 error and log', async () => {
        const error = {statusCode: 409, body: {errorCode: 201409036}};
        webex.request.rejects(error);
        LoggerProxy.logger.info = sinon.stub();
        await breakoutRequest.broadcast({url: 'url', message: 'hello', groupId: 'groupId'});
        assert.calledOnceWithExactly(
          LoggerProxy.logger.info,
          'Breakouts#broadcast --> no joined participants'
        );

        const otherError = new Error('something wrong');
        webex.request.rejects(otherError);
        LoggerProxy.logger.error = sinon.stub();
        await breakoutRequest.broadcast({url: 'url', message: 'hello', groupId: 'groupId'}).catch((error) => {
          assert.equal(error.toString(), 'Error: something wrong');
        });
      });
    });
  });
});

/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {assert, expect} from '@webex/test-helper-chai';
import AIAssistant from '@webex/internal-plugin-ai-assistant';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {set} from 'lodash';
import uuid from 'uuid';
import {Timer} from '@webex/common-timers';
import config from '@webex/internal-plugin-ai-assistant/src/config';
import {
  AI_ASSISTANT_ERROR_CODES,
  AI_ASSISTANT_ERRORS,
} from '@webex/internal-plugin-ai-assistant/src/constants';

const waitForAsync = () =>
  new Promise<void>((resolve) =>
    setImmediate(() => {
      return resolve();
    })
  );

chai.use(chaiAsPromised);
describe('plugin-ai-assistant', () => {
  describe('AIAssistant', () => {
    let webex;
    let uuidStub;
    let mercuryCallbacks;
    let clock;
    let timerSpy;

    beforeEach(() => {
      webex = MockWebex({
        canAuthorize: false,
        children: {
          aiAssistant: AIAssistant,
        },
      });

      // Set up default configuration
      webex.config.aiassistant = config;

      uuidStub = sinon.stub(uuid, 'v4').returns('test-request-id');

      webex.canAuthorize = true;

      mercuryCallbacks = {};

      webex.internal.mercury = {
        connect: sinon.stub().returns(Promise.resolve()),
        disconnect: sinon.stub().returns(Promise.resolve()),
        on: sinon.stub().callsFake((event, callback) => {
          mercuryCallbacks[event] = callback;
        }),
        off: sinon.spy(),
      };

      clock = sinon.useFakeTimers();

      // Stub Timer so we can control it in tests
      timerSpy = sinon.spy(Timer.prototype, 'start');
    });

    afterEach(() => {
      uuidStub.restore();
      clock.restore();
      if (timerSpy) {
        timerSpy.restore();
      }
    });

    describe('#register()', () => {
      it('registers correctly', async () => {
        await webex.internal.aiAssistant.register();

        assert.callCount(webex.internal.mercury.on, 1);

        const callArgs = webex.internal.mercury.on.getCall(0).args;

        expect(callArgs[0]).to.equal('event:assistant-api.response');
        expect(callArgs[1]).to.be.a('function');

        assert.equal(webex.internal.aiAssistant.registered, true);
      });

      it('rejects when it cannot authorize', async () => {
        webex.canAuthorize = false;

        await expect(webex.internal.aiAssistant.register()).to.be.rejectedWith(
          Error,
          'SDK cannot authorize'
        );

        assert.equal(webex.internal.aiAssistant.registered, false);
      });

      it('resolves immediately when already registered', async () => {
        webex.internal.aiAssistant.registered = true;

        await webex.internal.aiAssistant.register();

        assert.callCount(webex.internal.mercury.connect, 0);
        assert.equal(webex.internal.aiAssistant.registered, true);
      });
    });

    describe('#unregister()', () => {
      it('unregisters correctly', async () => {
        webex.internal.aiAssistant.registered = true;

        await webex.internal.aiAssistant.unregister();

        assert.callCount(webex.internal.mercury.off, 1);

        const callArgs = webex.internal.mercury.off.getCall(0).args;

        expect(callArgs[0]).to.equal('event:assistant-api.response');

        assert.equal(webex.internal.aiAssistant.registered, false);
      });

      it('resolves immediately when not registered', async () => {
        webex.internal.aiAssistant.registered = false;

        const result = await webex.internal.aiAssistant.unregister();

        expect(result).to.be.undefined;
        assert.callCount(webex.internal.mercury.disconnect, 0);
        assert.equal(webex.internal.aiAssistant.registered, false);
      });
    });

    // Interface for the data object used in testing events
    interface AssistantEventData {
      clientRequestId: any;
      response: {
        errorMessage?: string;
        errorCode?: string;
        [key: string]: any;
      };
      finished?: boolean;
      [key: string]: any;
    }

    // Helper function to create data objects for testing events
    const createData = (
      requestId: any,
      finished?: boolean,
      dataPath?: string,
      value?: any,
      encryptionKeyUrl?: string,
      errorMessage?: string,
      errorCode?: string,
      additionalResponseData?: any
    ): AssistantEventData => {
      const data: AssistantEventData = {
        clientRequestId: requestId,
        response: {
          // Add any additional response data first
          ...additionalResponseData,
        },
      };

      if (finished !== undefined) {
        data.finished = finished;
      }

      if (value !== undefined && encryptionKeyUrl !== undefined && dataPath) {
        set(data, dataPath, {
          value,
          encryptionKeyUrl,
        });
      }

      if (errorMessage !== undefined) {
        data.response.errorMessage = errorMessage;
      }

      if (errorCode !== undefined) {
        data.response.errorCode = errorCode;
      }

      return data;
    };

    describe('#_request', () => {
      beforeEach(() => {
        webex.request = sinon.stub().resolves({
          body: {
            id: 'test-message-id',
            url: 'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/test-session-id/messages/test-message-id',
            sessionId: 'test-session-id',
            sessionUrl:
              'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/test-session-id',
            creatorId: 'test-creator-id',
            createdAt: '2025-08-05T02:11:12.361Z',
          },
        });

        // Mock encryption functions
        webex.internal.encryption = {
          decryptText: sinon.stub().callsFake(async (keyUrl, value) => {
            return `decrypted-${value}`;
          }),
        };
      });

      it('makes a request to the assistant API', async () => {
        const requestPromise = webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
          dataPath: 'response.content',
        });

        expect(webex.request.getCall(0).args[0]).to.deep.equal({
          service: 'assistant-api',
          resource: 'test-resource',
          method: 'POST',
          contentType: 'application/json',
          body: {
            clientRequestId: 'test-request-id',
            param1: 'value1',
          },
        });

        const result = await requestPromise;

        expect(result).to.deep.equal({
          id: 'test-message-id',
          url: 'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/test-session-id/messages/test-message-id',
          sessionId: 'test-session-id',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/test-session-id',
          creatorId: 'test-creator-id',
          createdAt: '2025-08-05T02:11:12.361Z',
          requestId: 'test-request-id',
          streamEventName: 'aiassistant:stream:test-request-id',
        });
      });

      it('decrypts and emits data when receiving event data', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
          dataPath: 'response.content',
        });

        // Use createData with additional response data
        // Create a response that mimics the real structure where content has both metadata and encrypted data
        webex.internal.aiAssistant._handleEvent({
          clientRequestId: 'test-request-id',
          finished: true,
          response: {
            sessionId: 'test-session-id',
            messageId: 'test-message-id',
            content: {
              type: 'message',
              format: 'plainText',
              value: 'test-value',
              encryptionKeyUrl: 'test-key-url',
            },
          },
        });

        await waitForAsync();

        // Verify decryption was called
        expect(webex.internal.encryption.decryptText.calledOnce).to.be.true;
        expect(webex.internal.encryption.decryptText.getCall(0).args).to.deep.equal([
          'test-key-url',
          'test-value',
        ]);

        // Verify event was triggered with decrypted data and entire response object
        expect(triggerSpy.calledTwice).to.be.true; // Called once for streamEvent, once for resultEvent
        expect(triggerSpy.getCall(1).args[0]).to.equal('aiassistant:stream:test-request-id');
        const triggeredData = triggerSpy.getCall(1).args[1];
        expect(triggeredData).to.deep.include({
          message: 'decrypted-test-value',
          requestId: 'test-request-id',
          finished: true,
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
        });
        expect(triggeredData.content).to.deep.include({
          type: 'message',
          format: 'plainText',
        });
      });

      it('concatenates streamed messages for non-finished events', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
          dataPath: 'response.content',
        });

        // Create base response data that will be consistent across chunks
        const baseResponseData = {
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          responseId: 'test-response-id',
        };

        // Simulate first message chunk using createData
        webex.internal.aiAssistant._handleEvent(
          createData(
            'test-request-id',
            false,
            'response.content',
            'first-part-',
            'test-key-url',
            undefined,
            undefined,
            {
              ...baseResponseData,
              content: {
                type: 'message',
              },
            }
          )
        );

        await waitForAsync();

        // Check first chunk
        expect(triggerSpy.getCall(1).args[0]).to.equal('aiassistant:stream:test-request-id');
        const firstChunk = triggerSpy.getCall(1).args[1];
        expect(firstChunk).to.deep.include({
          message: 'decrypted-first-part-',
          finished: false,
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          responseId: 'test-response-id',
        });

        // Simulate second message chunk using createData
        webex.internal.aiAssistant._handleEvent(
          createData(
            'test-request-id',
            false,
            'response.content',
            'second-part',
            'test-key-url',
            undefined,
            undefined,
            {
              ...baseResponseData,
              content: {
                type: 'message',
              },
            }
          )
        );

        await waitForAsync();

        // Check second chunk - should include first and second part concatenated
        expect(triggerSpy.getCall(3).args[0]).to.equal('aiassistant:stream:test-request-id');
        const secondChunk = triggerSpy.getCall(3).args[1];
        expect(secondChunk).to.deep.include({
          message: 'decrypted-first-part-decrypted-second-part',
          finished: false,
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          responseId: 'test-response-id',
        });

        // Simulate final message using createData
        webex.internal.aiAssistant._handleEvent(
          createData(
            'test-request-id',
            true,
            'response.content',
            'final-part',
            'test-key-url',
            undefined,
            undefined,
            {
              ...baseResponseData,
              content: {
                type: 'message',
              },
            }
          )
        );

        await waitForAsync();

        // Check all trigger calls - first two should have concatenated message
        expect(triggerSpy.callCount).to.equal(6); // Three event pairs for result and stream

        // Check final message - stops concatenation, only returns the final version
        expect(triggerSpy.getCall(5).args[0]).to.equal('aiassistant:stream:test-request-id');
        const finalChunk = triggerSpy.getCall(5).args[1];
        expect(finalChunk).to.deep.include({
          message: 'decrypted-final-part',
          finished: true,
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          responseId: 'test-response-id',
        });
      });

      it('rejects with AIAssistantTimeoutError when server does not respond in time', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');
        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
          dataPath: 'response.content',
        });

        // Advance the clock past the timeout
        await clock.tickAsync(30001); // Default timeout + 1ms

        await waitForAsync();

        expect(triggerSpy.getCall(0).args[0]).to.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(0).args[1]).to.deep.include({
          requestId: 'test-request-id',
          finished: true,
          errorMessage: AI_ASSISTANT_ERRORS.AI_ASSISTANT_TIMEOUT,
          errorCode: AI_ASSISTANT_ERROR_CODES.AI_ASSISTANT_TIMEOUT,
        });
      });

      it('includes error information when server returns an error', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
          dataPath: 'response.content',
        });

        // Use createData for error case with additional response data
        webex.internal.aiAssistant._handleEvent(
          createData(
            'test-request-id',
            true,
            undefined,
            undefined,
            undefined,
            'Error message',
            'ERROR_CODE',
            {
              sessionId: 'test-session-id',
              messageId: 'test-message-id',
              content: {
                type: 'error',
              },
            }
          )
        );

        expect(triggerSpy.calledTwice).to.be.true;
        expect(triggerSpy.getCall(1).args[0]).to.equal('aiassistant:stream:test-request-id');
        const triggeredData = triggerSpy.getCall(1).args[1];
        expect(triggeredData).to.deep.include({
          message: '',
          requestId: 'test-request-id',
          finished: true,
          errorMessage: 'Error message',
          errorCode: 'ERROR_CODE',
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
        });
        expect(triggeredData.content).to.deep.include({
          type: 'error',
        });
      });
    });
  });
});

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
import {cloneDeep, merge, set} from 'lodash';
import uuid from 'uuid';
import {Timer} from '@webex/common-timers';
import config from '@webex/internal-plugin-ai-assistant/src/config';
import {
  AI_ASSISTANT_ERROR_CODES,
  AI_ASSISTANT_ERRORS,
} from '@webex/internal-plugin-ai-assistant/src/constants';
import {jsonResponse, messageResponse, workspaceResponse} from '../data/messages';

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

      it('handles a markdown response', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');
        webex.internal.encryption.decryptText.callsFake(async (keyUrl, value) => {
          return `decrypted-with-${keyUrl}-${value}`;
        });

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
        });

        // first event is a message chunk with an encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(messageResponse[0]));

        expect(triggerSpy.getCall(0).args[0]).to.equal(
          `aiassistant:result:${messageResponse[0].clientRequestId}`
        );

        await waitForAsync();

        let expectedResult = set(
          cloneDeep(messageResponse[0]),
          'response.content.value',
          'decrypted-with-keyUrl1-markdown_encrypted_value_0'
        );

        expect(triggerSpy.getCall(0).args[1]).to.deep.equal(expectedResult);

        // second event is the final message with an encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(messageResponse[1]));

        expectedResult = set(
          cloneDeep(messageResponse[1]),
          'response.content.value',
          'decrypted-with-keyUrl1-markdown_encrypted_value_1'
        );

        expect(triggerSpy.getCall(2).args[1]).to.deep.equal(expectedResult);
      });

      it('decrypts a chunked json response', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');
        webex.internal.encryption.decryptText.callsFake(async (keyUrl, value) => {
          return `decrypted-with-${keyUrl}-${value}`;
        });

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
        });

        // first event is a tool use with an encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(jsonResponse[0]));

        await waitForAsync();

        let expectedResult: any = {
          sessionId: '3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          messageId: '3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          messageUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          responseId: '3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          responseUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          content: {
            name: 'tool_use',
            type: 'json',
            value: {
              id: 'call_vrnUKW2CLWVN1O40qcY0Y4tD',
              name: '',
              type: 'markdown',
              value:
                'decrypted-with-kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e-json_0_encrypted_value',
            },
            encryptionKeyUrl: 'kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e',
          },
          createdAt: '2025-09-16T13:08:28.714399642Z',
          creator: {
            role: 'assistant',
          },
          // the below fields are added by the SDK
          errorCode: undefined,
          errorMessage: undefined,
          finished: false,
          requestId: 'test-request-id',
          responseType: 'thought',
        };
        expect(triggerSpy.getCall(1).args[0]).to.deep.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(1).args[1]).to.deep.equal(
          expectedResult
        );

        triggerSpy.resetHistory();

        // second event is a tool result which has no encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(jsonResponse[1]));

        await waitForAsync();

        expectedResult = {
          sessionId: '3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          messageId: '3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          messageUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          responseId: '3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          responseUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          content: {
            name: 'tool_result',
            type: 'json',
            value: {
              id: 'call_vrnUKW2CLWVN1O40qcY0Y4tD',
              name: '',
              type: 'markdown',
              status: 'success',
            },
          },
          createdAt: '2025-09-16T13:08:28.857717340Z',
          creator: {
            role: 'assistant',
          },
          // the below fields are added by the SDK
          errorCode: undefined,
          errorMessage: undefined,
          finished: false,
          requestId: 'test-request-id',
          responseType: 'thought',
        };
        expect(triggerSpy.getCall(1).args[0]).to.deep.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(1).args[1]).to.deep.equal(expectedResult);

        triggerSpy.resetHistory();

        // third event is another tool use with an encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(jsonResponse[2]));

        await waitForAsync();

        expectedResult = {
          sessionId: '3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          messageId: '3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          messageUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          responseId: '3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          responseUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          content: {
            name: 'tool_use',
            type: 'json',
            value: {
              id: 'call_Ay3G8P0WYtIltRYZOtz6qXDz',
              name: '',
              type: 'markdown',
              value:
                'decrypted-with-kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e-json_2_encrypted_value',
            },
            encryptionKeyUrl: 'kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e',
          },
          createdAt: '2025-09-16T13:08:29.597605274Z',
          creator: {
            role: 'assistant',
          },
          // the below fields are added by the SDK
          errorCode: undefined,
          errorMessage: undefined,
          finished: false,
          requestId: 'test-request-id',
          responseType: 'thought',
        };

        expect(triggerSpy.getCall(1).args[0]).to.deep.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(1).args[1]).to.deep.equal(expectedResult);

        triggerSpy.resetHistory();

        // fourth event is a cited answer with an encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(jsonResponse[3]));

        await waitForAsync();

        expectedResult = {
          sessionId: '3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          messageId: '3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          messageUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          responseId: '3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          responseUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          content: {
            name: 'cited_answer',
            type: 'json',
            encryptionKeyUrl: 'kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e',
            value: {
              value: 'decrypted-with-kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e-json_3_encrypted_value',
              type: 'markdown',
            },
          },
          createdAt: '2025-09-16T13:08:30.566298862Z',
          creator: {
            role: 'assistant',
          },
          // the below fields are added by the SDK
          errorCode: undefined,
          errorMessage: undefined,
          finished: false,
          requestId: 'test-request-id',
          responseType: 'response',
        };

        expect(triggerSpy.getCall(1).args[0]).to.deep.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(1).args[1]).to.deep.equal(expectedResult);

        triggerSpy.resetHistory();

        // fifth event is a tool result which has no encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(jsonResponse[4]));

        expectedResult = {
          sessionId: '3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          messageId: '3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          messageUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          responseId: '3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          responseUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          content: {
            name: 'tool_result',
            type: 'json',
            value: {
              id: 'call_Ay3G8P0WYtIltRYZOtz6qXDz',
              name: '',
              type: 'markdown',
              status: 'success',
            },
          },
          createdAt: '2025-09-16T13:08:30.574636837Z',
          creator: {
            role: 'assistant',
          },
          // the below fields are added by the SDK
          errorCode: undefined,
          errorMessage: undefined,
          finished: false,
          requestId: 'test-request-id',
          responseType: 'thought',
        };

        await waitForAsync();

        expect(triggerSpy.getCall(1).args[0]).to.deep.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(1).args[1]).to.deep.equal(expectedResult);

        triggerSpy.resetHistory();

        // sixth event is a cited answer with an encrypted value
        await webex.internal.aiAssistant._handleEvent(cloneDeep(jsonResponse[5]));

        await waitForAsync();

        expectedResult = {
          sessionId: '3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          sessionUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5',
          messageId: '3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          messageUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c19fd10-92fe-11f0-8e9f-1bafc66fbbc5',
          responseId: '3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          responseUrl:
            'https://assistant-api-a.wbx2.com:443/assistant-api/api/v1/sessions/3c1939c0-92fe-11f0-8e9f-1bafc66fbbc5/messages/3c1a4b30-92fe-11f0-8e9f-1bafc66fbbc5',
          content: {
            name: 'cited_answer',
            type: 'json',
            encryptionKeyUrl: 'kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e',
            value: {
              value:
                'decrypted-with-kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e-json_5_encrypted_value',
              type: 'markdown',
              citations: [
                {
                  id: '6ccc8286e2084e05a6b9a29faae77095',
                  index: 1,
                  name: 'decrypted-with-kms://kms-us.wbx2.com/keys/9565506d-78b1-4742-b0fd-63719748282e-json_5_encrypted_citation_0',
                  url: 'https://co.webex.com/webappng/sites/co/recording/playback/6ccc8286e2084e05a6b9a29faae77095',
                  metadata: {
                    provider: 'webex',
                    type: 'meeting_recording',
                  },
                },
              ],
            },
          },
          createdAt: '2025-09-16T13:08:30.594220705Z',
          creator: {
            role: 'assistant',
          },
          // the below fields are added by the SDK
          errorCode: undefined,
          errorMessage: undefined,
          finished: true,
          requestId: 'test-request-id',
          responseType: 'response',
        };

        expect(triggerSpy.getCall(1).args[0]).to.deep.equal('aiassistant:stream:test-request-id');
        expect(triggerSpy.getCall(1).args[1]).to.deep.equal(expectedResult);
      });

      it('handles a workspace response', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');
        webex.internal.encryption.decryptText.callsFake(async (keyUrl, value) => {
          return `decrypted-with-${keyUrl}-${value}`;
        });

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
        });

        // first event is a workspace chunk with an encrypted value
        // Update the clientRequestId to match the test setup
        const firstEvent = cloneDeep(workspaceResponse[0]);
        firstEvent.clientRequestId = 'test-request-id';
        
        await webex.internal.aiAssistant._handleEvent(firstEvent);

        expect(triggerSpy.getCall(0).args[0]).to.equal(
          `aiassistant:result:test-request-id`
        );

        await waitForAsync();

        let expectedResult = set(
          cloneDeep(firstEvent),
          'response.content.value.value',
          'decrypted-with-workspace_0_encryption_key_url-workspace_0_encrypted_value'
        );

        expect(triggerSpy.getCall(0).args[1]).to.deep.equal(expectedResult);

        // second event is another workspace chunk with an encrypted value
        const secondEvent = cloneDeep(workspaceResponse[1]);
        secondEvent.clientRequestId = 'test-request-id';
        
        await webex.internal.aiAssistant._handleEvent(secondEvent);

        expectedResult = set(
          cloneDeep(secondEvent),
          'response.content.value.value',
          'decrypted-with-workspace_1_encryption_key_url-workspace_1_encrypted_value'
        );

        expect(triggerSpy.getCall(2).args[1]).to.deep.equal(expectedResult);
      });      

      it('decrypts and emits data when receiving event data', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
        });

        // Use createData with additional response data
        // Create a response that mimics the real structure where content has both metadata and encrypted data
        await webex.internal.aiAssistant._handleEvent({
          clientRequestId: 'test-request-id',
          finished: true,
          response: {
            sessionId: 'test-session-id',
            messageId: 'test-message-id',
            content: {
              name: 'message',
              type: 'message',
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

        expect(triggeredData).to.deep.equal({
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          content: {
            name: 'message',
            type: 'message',
            value: 'decrypted-test-value',
            encryptionKeyUrl: 'test-key-url',
          },
          responseType: undefined,
          requestId: 'test-request-id',
          finished: true,
          errorMessage: undefined,
          errorCode: undefined,
        });
      });

      it('rejects with AIAssistantTimeoutError when server does not respond in time', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');
        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
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

      it('includes error information when server returns an error - unfinished', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
        });

        // Use createData for error case with additional response data
        webex.internal.aiAssistant._handleEvent(
          createData(
            'test-request-id',
            false,
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

        await waitForAsync();

        expect(webex.logger.error.notCalled).to.be.true; // No error should be logged internally

        expect(triggerSpy.calledTwice).to.be.true;
        expect(triggerSpy.getCall(1).args[0]).to.equal('aiassistant:stream:test-request-id');
        const triggeredData = triggerSpy.getCall(1).args[1];

        expect(triggeredData).to.deep.equal({
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          content: {type: 'error'},
          errorMessage: 'Error message',
          errorCode: 'ERROR_CODE',
          responseType: undefined,
          requestId: 'test-request-id',
          finished: false,
        });
      });

      it('includes error information when server returns an error', async () => {
        const triggerSpy = sinon.spy(webex.internal.aiAssistant, 'trigger');

        await webex.internal.aiAssistant._request({
          resource: 'test-resource',
          params: {param1: 'value1'},
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

        await waitForAsync();

        expect(webex.logger.error.notCalled).to.be.true; // No error should be logged internally

        expect(triggerSpy.calledTwice).to.be.true;
        expect(triggerSpy.getCall(1).args[0]).to.equal('aiassistant:stream:test-request-id');
        const triggeredData = triggerSpy.getCall(1).args[1];

        expect(triggeredData).to.deep.equal({
          sessionId: 'test-session-id',
          messageId: 'test-message-id',
          content: {type: 'error'},
          errorMessage: 'Error message',
          errorCode: 'ERROR_CODE',
          responseType: undefined,
          requestId: 'test-request-id',
          finished: true,
        });
      });
    });
  });
});

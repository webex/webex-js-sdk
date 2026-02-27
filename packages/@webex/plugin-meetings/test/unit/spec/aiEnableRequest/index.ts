/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {EventEmitter} from 'stream';

import AIEnableRequest from '../../../../src/aiEnableRequest/index';
import {AI_ENABLE_REQUEST, HTTP_VERBS, LOCUSEVENT, MEETINGS} from '../../../../src/constants';

describe('plugin-meetings', () => {
  describe('AIEnableRequest', () => {
    let webex: any;
    let aiEnableRequest: any;

    beforeEach(() => {
      // @ts-ignore - MockWebex is not typed correctly
      webex = new MockWebex({
        children: {
          aiEnableRequest: AIEnableRequest,
        },
      });

      aiEnableRequest = webex.internal.aiEnableRequest;

      // Set up mercury as an EventEmitter
      webex.internal.mercury = new EventEmitter();
    });

    describe('#namespace', () => {
      it('should have the correct namespace', () => {
        assert.equal(aiEnableRequest.namespace, MEETINGS);
      });
    });

    describe('#approvalUrlUpdate', () => {
      it('should update the approvalUrl property', () => {
        const testApprovalUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';

        aiEnableRequest.approvalUrlUpdate(testApprovalUrl);

        assert.equal(aiEnableRequest.approvalUrl, testApprovalUrl);
      });

      it('should handle updating approvalUrl multiple times', () => {
        const firstUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id-1/approval';
        const secondUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id-2/approval';

        aiEnableRequest.approvalUrlUpdate(firstUrl);
        assert.equal(aiEnableRequest.approvalUrl, firstUrl);

        aiEnableRequest.approvalUrlUpdate(secondUrl);
        assert.equal(aiEnableRequest.approvalUrl, secondUrl);
      });
    });

    describe('#selfParticipantIdUpdate', () => {
      it('should update the selfParticipantId property', () => {
        const testSelfParticipantId = 'participant-123';

        aiEnableRequest.selfParticipantIdUpdate(testSelfParticipantId);

        assert.equal(aiEnableRequest.selfParticipantId, testSelfParticipantId);
      });

      it('should handle updating selfParticipantId multiple times', () => {
        const firstId = 'participant-111';
        const secondId = 'participant-222';

        aiEnableRequest.selfParticipantIdUpdate(firstId);
        assert.equal(aiEnableRequest.selfParticipantId, firstId);

        aiEnableRequest.selfParticipantIdUpdate(secondId);
        assert.equal(aiEnableRequest.selfParticipantId, secondId);
      });

      it('should call listenToApprovalRequests on first update', () => {
        const listenToApprovalRequestsSpy = sinon.spy(aiEnableRequest, 'listenToApprovalRequests');
        const testSelfParticipantId = 'participant-123';

        aiEnableRequest.selfParticipantIdUpdate(testSelfParticipantId);

        sinon.assert.calledOnce(listenToApprovalRequestsSpy);
        assert.isTrue(aiEnableRequest.hasSubscribedToEvents);
      });

      it('should not call listenToApprovalRequests on subsequent updates', () => {
        const testSelfParticipantId = 'participant-123';

        // First update
        aiEnableRequest.selfParticipantIdUpdate(testSelfParticipantId);

        const listenToApprovalRequestsSpy = sinon.spy(aiEnableRequest, 'listenToApprovalRequests');

        // Second update
        aiEnableRequest.selfParticipantIdUpdate('participant-456');

        sinon.assert.notCalled(listenToApprovalRequestsSpy);
        assert.isTrue(aiEnableRequest.hasSubscribedToEvents);
      });
    });

    describe('#listenToApprovalRequests', () => {
      let listenToSpy;
      let triggerSpy;
      const testSelfParticipantId = 'self-participant-123';
      const testInitiatorId = 'initiator-participant-456';
      const testApproverId = 'approver-participant-789';
      const testUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';

      beforeEach(() => {
        aiEnableRequest.selfParticipantId = testSelfParticipantId;
        listenToSpy = sinon.spy(aiEnableRequest, 'listenTo');
        triggerSpy = sinon.spy(aiEnableRequest, 'trigger');
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should listen to mercury approval request events', () => {
        aiEnableRequest.listenToApprovalRequests();

        sinon.assert.calledOnce(listenToSpy);
        sinon.assert.calledWith(
          listenToSpy,
          webex.internal.mercury,
          `event:${LOCUSEVENT.APPROVAL_REQUEST}`
        );
      });

      it('should trigger event when user is the approver', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [{participantId: testSelfParticipantId}],
              initiator: {participantId: testInitiatorId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.calledOnce(triggerSpy);
        sinon.assert.calledWith(triggerSpy, AI_ENABLE_REQUEST.EVENTS.APPROVAL_REQUEST_ARRIVED, {
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          isApprover: true,
          isInitiator: false,
          initiatorId: testInitiatorId,
          approverId: testSelfParticipantId,
          url: testUrl,
        });
      });

      it('should trigger event when user is the initiator', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [{participantId: testApproverId}],
              initiator: {participantId: testSelfParticipantId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.calledOnce(triggerSpy);
        sinon.assert.calledWith(triggerSpy, AI_ENABLE_REQUEST.EVENTS.APPROVAL_REQUEST_ARRIVED, {
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          isApprover: false,
          isInitiator: true,
          initiatorId: testSelfParticipantId,
          approverId: testApproverId,
          url: testUrl,
        });
      });

      it('should not trigger event when user is neither approver nor initiator', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [{participantId: testApproverId}],
              initiator: {participantId: testInitiatorId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.notCalled(triggerSpy);
      });

      it('should not trigger event when resourceType does not match', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: 'SomeOtherResourceType',
              receivers: [{participantId: testSelfParticipantId}],
              initiator: {participantId: testInitiatorId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.notCalled(triggerSpy);
      });

      it('should handle events with different action types', () => {
        aiEnableRequest.listenToApprovalRequests();

        const actionTypes = [
          AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
          AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED,
          AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL,
        ];

        actionTypes.forEach((actionType) => {
          const event = {
            data: {
              approval: {
                resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
                receivers: [{participantId: testSelfParticipantId}],
                initiator: {participantId: testInitiatorId},
                actionType,
                url: testUrl,
              },
            },
          };

          webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);
        });

        sinon.assert.callCount(triggerSpy, actionTypes.length);
      });

      it('should handle missing approver participantId', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [{}],
              initiator: {participantId: testSelfParticipantId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.calledOnce(triggerSpy);
        const callArgs = triggerSpy.getCall(0).args[1];
        assert.isFalse(callArgs.isApprover);
        assert.isTrue(callArgs.isInitiator);
      });

      it('should handle missing initiator participantId', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [{participantId: testSelfParticipantId}],
              initiator: {},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.calledOnce(triggerSpy);
        const callArgs = triggerSpy.getCall(0).args[1];
        assert.isTrue(callArgs.isApprover);
        assert.isFalse(callArgs.isInitiator);
      });

      it('should handle empty receivers array', () => {
        aiEnableRequest.listenToApprovalRequests();

        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [],
              initiator: {participantId: testSelfParticipantId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
              url: testUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.calledOnce(triggerSpy);
        const callArgs = triggerSpy.getCall(0).args[1];
        assert.isFalse(callArgs.isApprover);
        assert.isTrue(callArgs.isInitiator);
      });

      it('should include all relevant data in triggered event', () => {
        aiEnableRequest.listenToApprovalRequests();

        const customUrl = 'https://custom.url/approval';
        const event = {
          data: {
            approval: {
              resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
              receivers: [{participantId: testSelfParticipantId}],
              initiator: {participantId: testInitiatorId},
              actionType: AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
              url: customUrl,
            },
          },
        };

        webex.internal.mercury.emit(`event:${LOCUSEVENT.APPROVAL_REQUEST}`, event);

        sinon.assert.calledOnce(triggerSpy);
        const triggeredEvent = triggerSpy.getCall(0).args[1];
        assert.equal(triggeredEvent.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED);
        assert.equal(triggeredEvent.url, customUrl);
        assert.equal(triggeredEvent.initiatorId, testInitiatorId);
        assert.equal(triggeredEvent.approverId, testSelfParticipantId);
        assert.isTrue(triggeredEvent.isApprover);
        assert.isFalse(triggeredEvent.isInitiator);
      });
    });

    describe('#requestEnableAIAssistant', () => {
      let requestStub;
      const testApprovalUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';
      const testSelfParticipantId = 'self-participant-123';
      const testApproverId = 'approver-participant-456';

      beforeEach(() => {
        aiEnableRequest.approvalUrl = testApprovalUrl;
        aiEnableRequest.selfParticipantId = testSelfParticipantId;
        requestStub = sinon.stub(aiEnableRequest, 'request').resolves({
          statusCode: 200,
          body: {},
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should make a POST request to the approval URL', async () => {
        await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        sinon.assert.calledOnce(requestStub);
        sinon.assert.calledWith(requestStub, {
          method: HTTP_VERBS.POST,
          uri: testApprovalUrl,
          body: {
            actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
            resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
            initiator: {
              participantId: testSelfParticipantId,
            },
            approver: {
              participantId: testApproverId,
            },
          },
        });
      });

      it('should use the correct action type REQUESTED', async () => {
        await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED);
      });

      it('should use the correct resource type AiAssistant', async () => {
        await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.resourceType, AI_ENABLE_REQUEST.RESOURCE_TYPE);
      });

      it('should include the initiator participant ID', async () => {
        await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.initiator, {
          participantId: testSelfParticipantId,
        });
      });

      it('should include the approver participant ID', async () => {
        await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.approver, {
          participantId: testApproverId,
        });
      });

      it('should return a Promise', () => {
        const result = aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        assert.instanceOf(result, Promise);
      });

      it('should resolve with the request response', async () => {
        const mockResponse = {
          statusCode: 200,
          body: {
            approvalId: 'approval-789',
          },
        };

        requestStub.resolves(mockResponse);

        const result = await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});

        assert.deepEqual(result, mockResponse);
      });

      it('should handle request failures', async () => {
        const mockError = new Error('Request failed');
        requestStub.rejects(mockError);

        try {
          await aiEnableRequest.requestEnableAIAssistant({approverId: testApproverId});
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.equal(error.message, 'Request failed');
        }
      });

      it('should work with different participant IDs', async () => {
        const differentSelfId = 'different-self-999';
        const differentApproverId = 'different-approver-888';

        aiEnableRequest.selfParticipantId = differentSelfId;
        await aiEnableRequest.requestEnableAIAssistant({approverId: differentApproverId});

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.initiator.participantId, differentSelfId);
        assert.equal(callArgs.body.approver.participantId, differentApproverId);
      });
    });

    describe('#sendApprovalRequest', () => {
      let requestStub;
      const testUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';
      const testInitiatorId = 'initiator-participant-123';
      const testApproverId = 'approver-participant-456';

      beforeEach(() => {
        requestStub = sinon.stub(aiEnableRequest, 'request').resolves({
          statusCode: 200,
          body: {},
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should make a request with the specified method', async () => {
        await aiEnableRequest.sendApprovalRequest({
          url: testUrl,
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          initiatorId: testInitiatorId,
          approverId: testApproverId,
          method: HTTP_VERBS.POST,
        });

        sinon.assert.calledOnce(requestStub);
        sinon.assert.calledWith(requestStub, {
          method: HTTP_VERBS.POST,
          uri: testUrl,
          body: {
            actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
            resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
            initiator: {
              participantId: testInitiatorId,
            },
            approver: {
              participantId: testApproverId,
            },
          },
        });
      });

      it('should accept any action type', async () => {
        await aiEnableRequest.sendApprovalRequest({
          url: testUrl,
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
          initiatorId: testInitiatorId,
          approverId: testApproverId,
          method: HTTP_VERBS.PUT,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED);
      });

      it('should include the correct resource type', async () => {
        await aiEnableRequest.sendApprovalRequest({
          url: testUrl,
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          initiatorId: testInitiatorId,
          approverId: testApproverId,
          method: HTTP_VERBS.POST,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.resourceType, AI_ENABLE_REQUEST.RESOURCE_TYPE);
      });

      it('should return a Promise', () => {
        const result = aiEnableRequest.sendApprovalRequest({
          url: testUrl,
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          initiatorId: testInitiatorId,
          approverId: testApproverId,
          method: HTTP_VERBS.POST,
        });

        assert.instanceOf(result, Promise);
      });

      it('should resolve with the request response', async () => {
        const mockResponse = {
          statusCode: 200,
          body: {approvalId: 'approval-789'},
        };

        requestStub.resolves(mockResponse);

        const result = await aiEnableRequest.sendApprovalRequest({
          url: testUrl,
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
          initiatorId: testInitiatorId,
          approverId: testApproverId,
          method: HTTP_VERBS.POST,
        });

        assert.deepEqual(result, mockResponse);
      });

      it('should handle request failures', async () => {
        const mockError = new Error('Request failed');
        requestStub.rejects(mockError);

        try {
          await aiEnableRequest.sendApprovalRequest({
            url: testUrl,
            actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
            initiatorId: testInitiatorId,
            approverId: testApproverId,
            method: HTTP_VERBS.POST,
          });
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.equal(error.message, 'Request failed');
        }
      });

      it('should use the specified HTTP method', async () => {
        await aiEnableRequest.sendApprovalRequest({
          url: testUrl,
          actionType: AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
          initiatorId: testInitiatorId,
          approverId: testApproverId,
          method: HTTP_VERBS.PUT,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.method, HTTP_VERBS.PUT);
      });
    });

    describe('#acceptEnableAIAssistantRequest', () => {
      let requestStub;
      const testUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';
      const testInitiatorId = 'initiator-participant-123';
      const testSelfParticipantId = 'self-participant-456';

      beforeEach(() => {
        aiEnableRequest.selfParticipantId = testSelfParticipantId;
        requestStub = sinon.stub(aiEnableRequest, 'request').resolves({
          statusCode: 200,
          body: {},
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should make a PUT request to the provided URL', async () => {
        await aiEnableRequest.acceptEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        sinon.assert.calledOnce(requestStub);
        sinon.assert.calledWith(requestStub, {
          method: HTTP_VERBS.PUT,
          uri: testUrl,
          body: {
            actionType: AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
            resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
            initiator: {
              participantId: testInitiatorId,
            },
            approver: {
              participantId: testSelfParticipantId,
            },
          },
        });
      });

      it('should use the correct action type ACCEPTED', async () => {
        await aiEnableRequest.acceptEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED);
      });

      it('should include the initiator participant ID', async () => {
        await aiEnableRequest.acceptEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.initiator, {
          participantId: testInitiatorId,
        });
      });

      it('should include the approver participant ID as selfParticipantId', async () => {
        await aiEnableRequest.acceptEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.approver, {
          participantId: testSelfParticipantId,
        });
      });

      it('should return a Promise', () => {
        const result = aiEnableRequest.acceptEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        assert.instanceOf(result, Promise);
      });

      it('should resolve with the request response', async () => {
        const mockResponse = {
          statusCode: 200,
          body: {success: true},
        };

        requestStub.resolves(mockResponse);

        const result = await aiEnableRequest.acceptEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        assert.deepEqual(result, mockResponse);
      });

      it('should handle request failures', async () => {
        const mockError = new Error('Request failed');
        requestStub.rejects(mockError);

        try {
          await aiEnableRequest.acceptEnableAIAssistantRequest({
            url: testUrl,
            initiatorId: testInitiatorId,
          });
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.equal(error.message, 'Request failed');
        }
      });
    });

    describe('#declineEnableAIAssistantRequest', () => {
      let requestStub;
      const testUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';
      const testInitiatorId = 'initiator-participant-123';
      const testSelfParticipantId = 'self-participant-456';

      beforeEach(() => {
        aiEnableRequest.selfParticipantId = testSelfParticipantId;
        requestStub = sinon.stub(aiEnableRequest, 'request').resolves({
          statusCode: 200,
          body: {},
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should make a PUT request to the provided URL', async () => {
        await aiEnableRequest.declineEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        sinon.assert.calledOnce(requestStub);
        sinon.assert.calledWith(requestStub, {
          method: HTTP_VERBS.PUT,
          uri: testUrl,
          body: {
            actionType: AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED,
            resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
            initiator: {
              participantId: testInitiatorId,
            },
            approver: {
              participantId: testSelfParticipantId,
            },
          },
        });
      });

      it('should use the correct action type DECLINED', async () => {
        await aiEnableRequest.declineEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED);
      });

      it('should include the initiator participant ID', async () => {
        await aiEnableRequest.declineEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.initiator, {
          participantId: testInitiatorId,
        });
      });

      it('should include the approver participant ID as selfParticipantId', async () => {
        await aiEnableRequest.declineEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.approver, {
          participantId: testSelfParticipantId,
        });
      });

      it('should return a Promise', () => {
        const result = aiEnableRequest.declineEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        assert.instanceOf(result, Promise);
      });

      it('should resolve with the request response', async () => {
        const mockResponse = {
          statusCode: 200,
          body: {success: true},
        };

        requestStub.resolves(mockResponse);

        const result = await aiEnableRequest.declineEnableAIAssistantRequest({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        assert.deepEqual(result, mockResponse);
      });

      it('should handle request failures', async () => {
        const mockError = new Error('Request failed');
        requestStub.rejects(mockError);

        try {
          await aiEnableRequest.declineEnableAIAssistantRequest({
            url: testUrl,
            initiatorId: testInitiatorId,
          });
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.equal(error.message, 'Request failed');
        }
      });
    });

    describe('#declineAllEnableAIAssistantRequests', () => {
      let requestStub;
      const testUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';
      const testInitiatorId = 'initiator-participant-123';
      const testSelfParticipantId = 'self-participant-456';

      beforeEach(() => {
        aiEnableRequest.selfParticipantId = testSelfParticipantId;
        requestStub = sinon.stub(aiEnableRequest, 'request').resolves({
          statusCode: 200,
          body: {},
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should make a PUT request to the provided URL', async () => {
        await aiEnableRequest.declineAllEnableAIAssistantRequests({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        sinon.assert.calledOnce(requestStub);
        sinon.assert.calledWith(requestStub, {
          method: HTTP_VERBS.PUT,
          uri: testUrl,
          body: {
            actionType: AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL,
            resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
            initiator: {
              participantId: testInitiatorId,
            },
            approver: {
              participantId: testSelfParticipantId,
            },
          },
        });
      });

      it('should use the correct action type DECLINED_ALL', async () => {
        await aiEnableRequest.declineAllEnableAIAssistantRequests({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL);
      });

      it('should include the initiator participant ID', async () => {
        await aiEnableRequest.declineAllEnableAIAssistantRequests({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.initiator, {
          participantId: testInitiatorId,
        });
      });

      it('should include the approver participant ID as selfParticipantId', async () => {
        await aiEnableRequest.declineAllEnableAIAssistantRequests({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.approver, {
          participantId: testSelfParticipantId,
        });
      });

      it('should return a Promise', () => {
        const result = aiEnableRequest.declineAllEnableAIAssistantRequests({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        assert.instanceOf(result, Promise);
      });

      it('should resolve with the request response', async () => {
        const mockResponse = {
          statusCode: 200,
          body: {declinedCount: 3},
        };

        requestStub.resolves(mockResponse);

        const result = await aiEnableRequest.declineAllEnableAIAssistantRequests({
          url: testUrl,
          initiatorId: testInitiatorId,
        });

        assert.deepEqual(result, mockResponse);
      });

      it('should handle request failures', async () => {
        const mockError = new Error('Request failed');
        requestStub.rejects(mockError);

        try {
          await aiEnableRequest.declineAllEnableAIAssistantRequests({
            url: testUrl,
            initiatorId: testInitiatorId,
          });
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.equal(error.message, 'Request failed');
        }
      });
    });
  });
});

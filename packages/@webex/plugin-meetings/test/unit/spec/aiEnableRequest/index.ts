/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import AIEnableRequest from '../../../../src/aiEnableRequest/index';
import {AI_ENABLE_REQUEST, HTTP_VERBS, MEETINGS} from '../../../../src/constants';

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

    describe('#requestEnableAIAssistant', () => {
      let requestStub;
      const testApprovalUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/test-id/approval';
      const testSelfParticipantId = 'self-participant-123';
      const testApproverId = 'approver-participant-456';

      beforeEach(() => {
        aiEnableRequest.approvalUrl = testApprovalUrl;
        requestStub = sinon.stub(aiEnableRequest, 'request').resolves({
          statusCode: 200,
          body: {},
        });
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should make a POST request to the approval URL', async () => {
        await aiEnableRequest.requestEnableAIAssistant(testSelfParticipantId, testApproverId);

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
        await aiEnableRequest.requestEnableAIAssistant(testSelfParticipantId, testApproverId);

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.actionType, AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED);
      });

      it('should use the correct resource type AiAssistant', async () => {
        await aiEnableRequest.requestEnableAIAssistant(testSelfParticipantId, testApproverId);

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.resourceType, AI_ENABLE_REQUEST.RESOURCE_TYPE);
      });

      it('should include the initiator participant ID', async () => {
        await aiEnableRequest.requestEnableAIAssistant(testSelfParticipantId, testApproverId);

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.initiator, {
          participantId: testSelfParticipantId,
        });
      });

      it('should include the approver participant ID', async () => {
        await aiEnableRequest.requestEnableAIAssistant(testSelfParticipantId, testApproverId);

        const callArgs = requestStub.getCall(0).args[0];
        assert.deepEqual(callArgs.body.approver, {
          participantId: testApproverId,
        });
      });

      it('should return a Promise', () => {
        const result = aiEnableRequest.requestEnableAIAssistant(
          testSelfParticipantId,
          testApproverId
        );

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

        const result = await aiEnableRequest.requestEnableAIAssistant(
          testSelfParticipantId,
          testApproverId
        );

        assert.deepEqual(result, mockResponse);
      });

      it('should handle request failures', async () => {
        const mockError = new Error('Request failed');
        requestStub.rejects(mockError);

        try {
          await aiEnableRequest.requestEnableAIAssistant(testSelfParticipantId, testApproverId);
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.equal(error.message, 'Request failed');
        }
      });

      it('should work with different participant IDs', async () => {
        const differentSelfId = 'different-self-999';
        const differentApproverId = 'different-approver-888';

        await aiEnableRequest.requestEnableAIAssistant(differentSelfId, differentApproverId);

        const callArgs = requestStub.getCall(0).args[0];
        assert.equal(callArgs.body.initiator.participantId, differentSelfId);
        assert.equal(callArgs.body.approver.participantId, differentApproverId);
      });
    });
  });
});

import {
  checkParticipantNotInInteraction,
  getIsConferenceInProgress,
  isParticipantInMainInteraction,
  isPrimary,
  isAutoAnswerEnabled,
  isWebRTCCall,
  isDigitalOutbound,
  hasAgentInitiatedOutdial,
  shouldAutoAnswerTask,
} from '../../../../../src/services/task/TaskUtils';
import {ITask, Interaction, TaskData} from '../../../../../src/services/task/types';
import {LoginOption} from '../../../../../src/types';

describe('TaskUtils', () => {
  let mockTask: ITask;
  const mockAgentId = 'agent-123';
  const mockOtherAgentId = 'agent-456';

  beforeEach(() => {
    mockTask = {
      data: {
        interactionId: 'interaction-123',
        agentId: mockAgentId,
        interaction: {
          owner: mockAgentId,
          participants: {
            [mockAgentId]: { hasLeft: false },
            [mockOtherAgentId]: { hasLeft: false },
          },
          media: {
            'media-1': {
              mType: 'mainCall',
              participants: [mockAgentId, mockOtherAgentId],
            },
          },
        },
      },
      emit: jest.fn(),
      updateTaskData: jest.fn(),
    } as any;
  });

  describe('isPrimary', () => {
    it('should return true when agent is the owner', () => {
      expect(isPrimary(mockTask, mockAgentId)).toBe(true);
    });

    it('should return false when agent is not the owner', () => {
      expect(isPrimary(mockTask, mockOtherAgentId)).toBe(false);
    });

    it('should fallback to data.agentId when owner is not set', () => {
      mockTask.data.interaction.owner = undefined;
      expect(isPrimary(mockTask, mockAgentId)).toBe(true);
      expect(isPrimary(mockTask, mockOtherAgentId)).toBe(false);
    });
  });

  describe('isParticipantInMainInteraction', () => {
    it('should return true when agent is in mainCall media', () => {
      expect(isParticipantInMainInteraction(mockTask, mockAgentId)).toBe(true);
    });

    it('should return false when agent is not in mainCall media', () => {
      mockTask.data.interaction.media['media-1'].participants = [mockOtherAgentId];
      expect(isParticipantInMainInteraction(mockTask, mockAgentId)).toBe(false);
    });

    it('should return false when no mainCall media exists', () => {
      mockTask.data.interaction.media['media-1'].mType = 'consult';
      expect(isParticipantInMainInteraction(mockTask, mockAgentId)).toBe(false);
    });
  });

  describe('checkParticipantNotInInteraction', () => {
    it('should return false when agent is active participant', () => {
      expect(checkParticipantNotInInteraction(mockTask, mockAgentId)).toBe(false);
    });

    it('should return true when agent is not in participants', () => {
      delete mockTask.data.interaction.participants[mockAgentId];
      expect(checkParticipantNotInInteraction(mockTask, mockAgentId)).toBe(true);
    });

    it('should return true when agent has left', () => {
      mockTask.data.interaction.participants[mockAgentId].hasLeft = true;
      expect(checkParticipantNotInInteraction(mockTask, mockAgentId)).toBe(true);
    });
  });

  describe('getIsConferenceInProgress', () => {
    beforeEach(() => {
      // Set up mock task with proper media structure for conference detection
      mockTask.data.interaction.media = {
        [mockTask.data.interactionId]: {
          mType: 'mainCall',
          participants: [mockAgentId, mockOtherAgentId, 'customer-123'],
        },
      };
      mockTask.data.interaction.participants = {
        [mockAgentId]: { pType: 'Agent', hasLeft: false },
        [mockOtherAgentId]: { pType: 'Agent', hasLeft: false },
        'customer-123': { pType: 'Customer', hasLeft: false },
      };
    });

    it('should return true when there are 2 or more active agents', () => {
      expect(getIsConferenceInProgress(mockTask.data)).toBe(true);
    });

    it('should return false when there is only 1 active agent', () => {
      mockTask.data.interaction.participants[mockOtherAgentId].hasLeft = true;
      expect(getIsConferenceInProgress(mockTask.data)).toBe(false);
    });

    it('should exclude customers from agent count', () => {
      // Remove one agent, should still be false with only 1 agent + customer
      delete mockTask.data.interaction.participants[mockOtherAgentId];
      mockTask.data.interaction.media[mockTask.data.interactionId].participants = [mockAgentId, 'customer-123'];
      expect(getIsConferenceInProgress(mockTask.data)).toBe(false);
    });

    it('should exclude supervisors from agent count', () => {
      mockTask.data.interaction.participants[mockOtherAgentId].pType = 'Supervisor';
      expect(getIsConferenceInProgress(mockTask.data)).toBe(false);
    });

    it('should exclude VVA from agent count', () => {
      mockTask.data.interaction.participants[mockOtherAgentId].pType = 'VVA';
      expect(getIsConferenceInProgress(mockTask.data)).toBe(false);
    });

    it('should return false when no main call media exists', () => {
      mockTask.data.interaction.media = {};
      expect(getIsConferenceInProgress(mockTask.data)).toBe(false);
    });
  });

  describe('Auto-Answer Helper Functions', () => {
    let mockInteraction: Interaction;

    beforeEach(() => {
      mockInteraction = {
        interactionId: 'interaction-123',
        mediaType: 'telephony',
        mediaChannel: 'telephony',
        participants: {
          [mockAgentId]: {
            id: mockAgentId,
            pType: 'Agent',
            autoAnswerEnabled: false,
            hasJoined: false,
            hasLeft: false,
          },
        },
        owner: mockAgentId,
        contactDirection: {type: 'INBOUND'},
        outboundType: null,
        callProcessingDetails: {
          QMgrName: 'aqm',
          taskToBeSelfServiced: 'false',
          ani: '+1234567890',
          displayAni: '+1234567890',
          dnis: '+0987654321',
          tenantId: 'tenant-123',
          QueueId: 'queue-123',
          vteamId: 'vteam-123',
          customerName: 'Test Customer',
          virtualTeamName: 'Test Team',
          ronaTimeout: '30',
          category: 'Support',
          reason: 'General',
          sourceNumber: '+1234567890',
          sourcePage: 'web',
          appUser: 'test-app',
          customerNumber: '+1234567890',
          reasonCode: '100',
          IvrPath: '/ivr/path',
          pathId: 'path-123',
          fromAddress: 'customer@example.com',
        },
        previousVTeams: [],
        state: 'new',
        currentVTeam: 'vteam-123',
        isFcManaged: false,
        isTerminated: false,
        orgId: 'org-123',
        createdTimestamp: Date.now(),
        media: {},
      } as any;
    });

    describe('isAutoAnswerEnabled', () => {
      it('should return true when autoAnswerEnabled is true', () => {
        mockInteraction.participants[mockAgentId].autoAnswerEnabled = true;
        expect(isAutoAnswerEnabled(mockInteraction, mockAgentId)).toBe(true);
      });

      it('should return false when autoAnswerEnabled is false', () => {
        mockInteraction.participants[mockAgentId].autoAnswerEnabled = false;
        expect(isAutoAnswerEnabled(mockInteraction, mockAgentId)).toBe(false);
      });

      it('should return false when autoAnswerEnabled is not set', () => {
        delete mockInteraction.participants[mockAgentId].autoAnswerEnabled;
        expect(isAutoAnswerEnabled(mockInteraction, mockAgentId)).toBe(false);
      });

      it('should return false when participant does not exist', () => {
        expect(isAutoAnswerEnabled(mockInteraction, 'non-existent-agent')).toBe(false);
      });
    });

    describe('isWebRTCCall', () => {
      it('should return true for BROWSER login with telephony media type and webRTC enabled', () => {
        expect(isWebRTCCall(mockInteraction, LoginOption.BROWSER, true)).toBe(true);
      });

      it('should return false when webRTC is disabled', () => {
        expect(isWebRTCCall(mockInteraction, LoginOption.BROWSER, false)).toBe(false);
      });

      it('should return false for AGENT_DN login', () => {
        expect(isWebRTCCall(mockInteraction, LoginOption.AGENT_DN, true)).toBe(false);
      });

      it('should return false for EXTENSION login', () => {
        expect(isWebRTCCall(mockInteraction, LoginOption.EXTENSION, true)).toBe(false);
      });

      it('should return false for BROWSER login with non-telephony media type', () => {
        mockInteraction.mediaType = 'email';
        expect(isWebRTCCall(mockInteraction, LoginOption.BROWSER, true)).toBe(false);
      });
    });

    describe('isDigitalOutbound', () => {
      it('should return true for email outdial', () => {
        mockInteraction.contactDirection = {type: 'OUTBOUND'};
        mockInteraction.outboundType = 'OUTDIAL';
        mockInteraction.mediaChannel = 'email';
        expect(isDigitalOutbound(mockInteraction)).toBe(true);
      });

      it('should return true for SMS outdial', () => {
        mockInteraction.contactDirection = {type: 'OUTBOUND'};
        mockInteraction.outboundType = 'OUTDIAL';
        mockInteraction.mediaChannel = 'sms';
        expect(isDigitalOutbound(mockInteraction)).toBe(true);
      });

      it('should return false for telephony outdial', () => {
        mockInteraction.contactDirection = {type: 'OUTBOUND'};
        mockInteraction.outboundType = 'OUTDIAL';
        mockInteraction.mediaChannel = 'telephony';
        expect(isDigitalOutbound(mockInteraction)).toBe(false);
      });

      it('should return false for inbound email', () => {
        mockInteraction.contactDirection = {type: 'INBOUND'};
        mockInteraction.mediaChannel = 'email';
        expect(isDigitalOutbound(mockInteraction)).toBe(false);
      });

      it('should return false when outboundType is not OUTDIAL', () => {
        mockInteraction.contactDirection = {type: 'OUTBOUND'};
        mockInteraction.outboundType = 'CALLBACK';
        mockInteraction.mediaChannel = 'email';
        expect(isDigitalOutbound(mockInteraction)).toBe(false);
      });
    });

    describe('hasAgentInitiatedOutdial', () => {
      beforeEach(() => {
        mockInteraction.contactDirection = {type: 'OUTBOUND'};
        mockInteraction.outboundType = 'OUTDIAL';
        mockInteraction.owner = mockAgentId;
        mockInteraction.callProcessingDetails.outdialAgentId = mockAgentId;
        mockInteraction.callProcessingDetails.BLIND_TRANSFER_IN_PROGRESS = false;
      });

      it('should return true for agent-initiated outdial', () => {
        expect(hasAgentInitiatedOutdial(mockInteraction, mockAgentId)).toBe(true);
      });

      it('should return false when not outbound', () => {
        mockInteraction.contactDirection = {type: 'INBOUND'};
        expect(hasAgentInitiatedOutdial(mockInteraction, mockAgentId)).toBe(false);
      });

      it('should return false when not OUTDIAL type', () => {
        mockInteraction.outboundType = 'CALLBACK';
        expect(hasAgentInitiatedOutdial(mockInteraction, mockAgentId)).toBe(false);
      });

      it('should return false when outdialAgentId does not match', () => {
        mockInteraction.callProcessingDetails.outdialAgentId = mockOtherAgentId;
        expect(hasAgentInitiatedOutdial(mockInteraction, mockAgentId)).toBe(false);
      });

      it('should return false when owner does not match', () => {
        mockInteraction.owner = mockOtherAgentId;
        expect(hasAgentInitiatedOutdial(mockInteraction, mockAgentId)).toBe(false);
      });

      it('should return false when blind transfer is in progress', () => {
        mockInteraction.callProcessingDetails.BLIND_TRANSFER_IN_PROGRESS = true;
        expect(hasAgentInitiatedOutdial(mockInteraction, mockAgentId)).toBe(false);
      });
    });

    describe('shouldAutoAnswerTask', () => {
      let mockTaskData: TaskData;

      beforeEach(() => {
        mockTaskData = {
          interactionId: 'interaction-123',
          agentId: mockAgentId,
          interaction: mockInteraction,
        } as any;
      });

      describe('WebRTC scenarios', () => {
        beforeEach(() => {
          mockInteraction.mediaType = 'telephony';
        });

        it('should return true when auto-answer is enabled for WebRTC call', () => {
          mockInteraction.participants[mockAgentId].autoAnswerEnabled = true;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            true
          );
        });

        it('should return true for agent-initiated WebRTC outdial', () => {
          mockInteraction.contactDirection = {type: 'OUTBOUND'};
          mockInteraction.outboundType = 'OUTDIAL';
          mockInteraction.owner = mockAgentId;
          mockInteraction.callProcessingDetails.outdialAgentId = mockAgentId;
          mockInteraction.callProcessingDetails.BLIND_TRANSFER_IN_PROGRESS = false;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            true
          );
        });

        it('should return false for WebRTC call without auto-answer or outdial', () => {
          mockInteraction.participants[mockAgentId].autoAnswerEnabled = false;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            false
          );
        });

        it('should return false when webRTC is disabled', () => {
          mockInteraction.participants[mockAgentId].autoAnswerEnabled = true;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, false)).toBe(
            false
          );
        });

        it('should return false for non-BROWSER login', () => {
          mockInteraction.participants[mockAgentId].autoAnswerEnabled = true;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.AGENT_DN, true)).toBe(
            false
          );
        });
      });

      describe('Digital outbound scenarios', () => {
        beforeEach(() => {
          mockInteraction.contactDirection = {type: 'OUTBOUND'};
          mockInteraction.outboundType = 'OUTDIAL';
          mockInteraction.owner = mockAgentId;
          mockInteraction.callProcessingDetails.outdialAgentId = mockAgentId;
          mockInteraction.previousVTeams = [];
        });

        it('should return true for agent-initiated email outdial', () => {
          mockInteraction.mediaType = 'email';
          mockInteraction.mediaChannel = 'email';
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            true
          );
        });

        it('should return true for agent-initiated SMS outdial', () => {
          mockInteraction.mediaType = 'sms';
          mockInteraction.mediaChannel = 'sms';
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            true
          );
        });

        it('should return false when digital outbound has previous vteams', () => {
          mockInteraction.mediaType = 'email';
          mockInteraction.mediaChannel = 'email';
          mockInteraction.previousVTeams = ['vteam-1'];
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            false
          );
        });

        it('should return false when digital outbound is not agent-initiated', () => {
          mockInteraction.mediaType = 'email';
          mockInteraction.mediaChannel = 'email';
          mockInteraction.owner = mockOtherAgentId;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            false
          );
        });
      });

      describe('Edge cases', () => {
        it('should return false when interaction is null', () => {
          mockTaskData.interaction = null as any;
          expect(shouldAutoAnswerTask(mockTaskData, mockAgentId, LoginOption.BROWSER, true)).toBe(
            false
          );
        });

        it('should return false when agentId is null', () => {
          expect(shouldAutoAnswerTask(mockTaskData, null as any, LoginOption.BROWSER, true)).toBe(
            false
          );
        });

        it('should return false when agentId is empty string', () => {
          expect(shouldAutoAnswerTask(mockTaskData, '', LoginOption.BROWSER, true)).toBe(false);
        });
      });
    });
  });
});

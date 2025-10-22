import { checkParticipantNotInInteraction,
  getIsConferenceInProgress,
  isParticipantInMainInteraction,
  isPrimary,} from '../../../../../src/services/task/TaskUtils';
import {ITask} from '../../../../../src/services/task/types';

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
      expect(getIsConferenceInProgress(mockTask)).toBe(true);
    });

    it('should return false when there is only 1 active agent', () => {
      mockTask.data.interaction.participants[mockOtherAgentId].hasLeft = true;
      expect(getIsConferenceInProgress(mockTask)).toBe(false);
    });

    it('should exclude customers from agent count', () => {
      // Remove one agent, should still be false with only 1 agent + customer
      delete mockTask.data.interaction.participants[mockOtherAgentId];
      mockTask.data.interaction.media[mockTask.data.interactionId].participants = [mockAgentId, 'customer-123'];
      expect(getIsConferenceInProgress(mockTask)).toBe(false);
    });

    it('should exclude supervisors from agent count', () => {
      mockTask.data.interaction.participants[mockOtherAgentId].pType = 'Supervisor';
      expect(getIsConferenceInProgress(mockTask)).toBe(false);
    });

    it('should exclude VVA from agent count', () => {
      mockTask.data.interaction.participants[mockOtherAgentId].pType = 'VVA';
      expect(getIsConferenceInProgress(mockTask)).toBe(false);
    });

    it('should return false when no main call media exists', () => {
      mockTask.data.interaction.media = {};
      expect(getIsConferenceInProgress(mockTask)).toBe(false);
    });
  });
});

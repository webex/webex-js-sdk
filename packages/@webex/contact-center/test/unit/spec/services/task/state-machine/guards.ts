import {guards, GuardParams} from '../../../../../../src/services/task/state-machine/guards';
import {TaskContext} from '../../../../../../src/services/task/state-machine/types';
import {MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE} from '../../../../../../src/services/task/state-machine/constants';

describe('State Machine Guards', () => {
  const createContext = (overrides: Partial<TaskContext> = {}): TaskContext =>
    ({
      interactionId: 'interaction-123',
      recordingControlsAvailable: false,
      recordingInProgress: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      consultInitiator: false,
      taskData: {
        interactionId: 'interaction-123',
        interaction: {mainInteractionId: 'interaction-123', participants: {}, media: {}},
      },
      ...overrides,
    }) as TaskContext;

  const createParams = (context: TaskContext): GuardParams => ({context});

  describe('Recording Guards', () => {
    it('recordingActive returns true when controls available and recording', () => {
      const ctx = createContext({recordingControlsAvailable: true, recordingInProgress: true});
      expect(guards.recordingActive(createParams(ctx))).toBe(true);
    });

    it('recordingActive returns false when not recording', () => {
      const ctx = createContext({recordingControlsAvailable: true, recordingInProgress: false});
      expect(guards.recordingActive(createParams(ctx))).toBe(false);
    });

    it('recordingPaused returns true when controls available but not recording', () => {
      const ctx = createContext({recordingControlsAvailable: true, recordingInProgress: false});
      expect(guards.recordingPaused(createParams(ctx))).toBe(true);
    });
  });

  describe('Conference Guards', () => {
    it('isConferenceInProgress returns true with 2+ agents', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {
              'a1': {pType: 'Agent', hasLeft: false},
              'a2': {pType: 'Agent', hasLeft: false},
            },
            media: {'i-123': {mType: 'mainCall', participants: ['a1', 'a2']}},
          },
        },
      } as any);
      expect(guards.isConferenceInProgress(createParams(ctx))).toBe(true);
    });

    it('isConferenceInProgress returns false with 1 agent', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'a1': {pType: 'Agent', hasLeft: false}},
            media: {'i-123': {mType: 'mainCall', participants: ['a1']}},
          },
        },
      } as any);
      expect(guards.isConferenceInProgress(createParams(ctx))).toBe(false);
    });

    it('maxParticipantsReached returns true at max', () => {
      const agents: Record<string, any> = {};
      const participants: string[] = [];
      for (let i = 0; i < MAX_PARTICIPANTS_IN_MULTIPARTY_CONFERENCE; i++) {
        agents[`a${i}`] = {pType: 'Agent', hasLeft: false};
        participants.push(`a${i}`);
      }
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: agents,
            media: {'i-123': {mType: 'mainCall', participants}},
          },
        },
      } as any);
      expect(guards.maxParticipantsReached(createParams(ctx))).toBe(true);
    });

    it('canAddParticipant returns true below max', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'a1': {pType: 'Agent', hasLeft: false}},
            media: {'i-123': {mType: 'mainCall', participants: ['a1']}},
          },
        },
      } as any);
      expect(guards.canAddParticipant(createParams(ctx))).toBe(true);
    });

    it('isLastWxCCAgent returns true with 1 agent', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'a1': {pType: 'Agent', hasLeft: false}},
            media: {'i-123': {mType: 'mainCall', participants: ['a1']}},
          },
        },
      } as any);
      expect(guards.isLastWxCCAgent(createParams(ctx))).toBe(true);
    });

    it('shouldDowngradeConference returns true with <2 agents', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'a1': {pType: 'Agent', hasLeft: false}},
            media: {'i-123': {mType: 'mainCall', participants: ['a1']}},
          },
        },
      } as any);
      expect(guards.shouldDowngradeConference(createParams(ctx))).toBe(true);
    });
  });

  describe('Customer Guards', () => {
    it('customerInCall returns true when customer active', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'c1': {pType: 'Customer', hasLeft: false}},
            media: {'i-123': {mType: 'mainCall', participants: ['c1']}},
          },
        },
      } as any);
      expect(guards.customerInCall(createParams(ctx))).toBe(true);
    });

    it('customerNotInCall returns true when customer left', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'c1': {pType: 'Customer', hasLeft: true}},
            media: {'i-123': {mType: 'mainCall', participants: ['c1']}},
          },
        },
      } as any);
      expect(guards.customerNotInCall(createParams(ctx))).toBe(true);
    });
  });

  describe('Consult Guards', () => {
    it('consultInProgress returns true with consult media', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {media: {'consult-456': {mType: 'consult'}}},
        },
      } as any);
      expect(guards.consultInProgress(createParams(ctx))).toBe(true);
    });

    it('noConsultInProgress returns true without consult media', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {media: {'i-123': {mType: 'mainCall'}}},
        },
      } as any);
      expect(guards.noConsultInProgress(createParams(ctx))).toBe(true);
    });

    it('consultDestinationAgentJoined returns context value', () => {
      expect(guards.consultDestinationAgentJoined(createParams(createContext({consultDestinationAgentJoined: true})))).toBe(true);
      expect(guards.consultDestinationAgentJoined(createParams(createContext({consultDestinationAgentJoined: false})))).toBe(false);
    });

    it('consultCallHeld returns context value', () => {
      expect(guards.consultCallHeld(createParams(createContext({consultCallHeld: true})))).toBe(true);
      expect(guards.consultCallNotHeld(createParams(createContext({consultCallHeld: false})))).toBe(true);
    });

    it('isConsultInitiator/isConsultedAgent returns context value', () => {
      expect(guards.isConsultInitiator(createParams(createContext({consultInitiator: true})))).toBe(true);
      expect(guards.isConsultedAgent(createParams(createContext({consultInitiator: false})))).toBe(true);
    });
  });

  describe('Composite Guards', () => {
    it('canConsult returns true when all conditions met', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {
              'a1': {pType: 'Agent', hasLeft: false},
              'c1': {pType: 'Customer', hasLeft: false},
            },
            media: {'i-123': {mType: 'mainCall', participants: ['a1', 'c1']}},
          },
        },
      } as any);
      expect(guards.canConsult(createParams(ctx))).toBe(true);
    });

    it('canMergeToConference returns true when consult agent joined', () => {
      const ctx = createContext({
        consultDestinationAgentJoined: true,
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {'a1': {pType: 'Agent', hasLeft: false}},
            media: {'i-123': {mType: 'mainCall', participants: ['a1']}},
          },
        },
      } as any);
      expect(guards.canMergeToConference(createParams(ctx))).toBe(true);
    });

    it('canExitConference returns true in conference without consult', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {
              'a1': {pType: 'Agent', hasLeft: false},
              'a2': {pType: 'Agent', hasLeft: false},
            },
            media: {'i-123': {mType: 'mainCall', participants: ['a1', 'a2']}},
          },
        },
      } as any);
      expect(guards.canExitConference(createParams(ctx))).toBe(true);
    });

    it('canTransferConference returns true in conference without consult', () => {
      const ctx = createContext({
        taskData: {
          interactionId: 'i-123',
          interaction: {
            mainInteractionId: 'i-123',
            participants: {
              'a1': {pType: 'Agent', hasLeft: false},
              'a2': {pType: 'Agent', hasLeft: false},
            },
            media: {'i-123': {mType: 'mainCall', participants: ['a1', 'a2']}},
          },
        },
      } as any);
      expect(guards.canTransferConference(createParams(ctx))).toBe(true);
    });
  });
});

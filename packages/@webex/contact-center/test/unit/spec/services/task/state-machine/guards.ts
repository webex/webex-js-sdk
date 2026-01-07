import {guards, GuardParams} from '../../../../../../src/services/task/state-machine/guards';
import {TaskContext} from '../../../../../../src/services/task/state-machine/types';

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

  describe('Consult Guards', () => {
    it('isConsultInitiator returns context value', () => {
      expect(guards.isConsultInitiator(createParams(createContext({consultInitiator: true})))).toBe(true);
    });
  });
});

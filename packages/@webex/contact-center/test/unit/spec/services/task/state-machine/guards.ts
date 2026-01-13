import {guards, GuardParams} from '../../../../../../src/services/task/state-machine/guards';
import {TaskContext, TaskEventPayload} from '../../../../../../src/services/task/state-machine/types';
import {TaskData, InteractionParticipant} from '../../../../../../src/services/task/types';

describe('State Machine Guards', () => {
  const createParticipant = (id: string, pType: string, hasLeft = false): InteractionParticipant => ({
    id,
    pType,
    type: pType,
    hasJoined: true,
    hasLeft,
    isInPredial: false,
  });
  // Note: media key must match mainInteractionId for getIsConferenceInProgress to work
  const INTERACTION_ID = 'interaction-123';

  const createTaskData = (overrides: Partial<TaskData> = {}): TaskData => ({
    mediaResourceId: INTERACTION_ID,
    eventType: 'TEST_EVENT',
    agentId: 'agent-123',
    destAgentId: '',
    trackingId: 'track-123',
    consultMediaResourceId: '',
    interactionId: INTERACTION_ID,
    orgId: 'org-123',
    owner: 'agent-123',
    queueMgr: 'queue-mgr',
    type: 'voice',
    isConferencing: false,
    interaction: {
      mainInteractionId: INTERACTION_ID,
      interactionId: INTERACTION_ID,
      participants: {},
      media: {
        [INTERACTION_ID]: {
          mediaResourceId: INTERACTION_ID,
          mediaType: 'telephony',
          mediaMgr: 'media-mgr',
          participants: ['agent-123'],
          mType: 'mainCall',
          isHold: false,
          holdTimestamp: null,
        },
      },
      owner: 'agent-123',
      mediaChannel: 'telephony',
      contactDirection: {type: 'inbound'},
    },
    ...overrides,
  } as TaskData);

  const createContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
      recordingControlsAvailable: false,
      recordingInProgress: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      consultInitiator: false,
    exitingConference: false,
    consultDestinationType: null,
    taskData: createTaskData(),
    uiControlConfig: {agentId: 'agent-123'},
    uiControls: {
      accept: {isVisible: false, isEnabled: false},
      decline: {isVisible: false, isEnabled: false},
      hold: {isVisible: false, isEnabled: false},
      end: {isVisible: false, isEnabled: false},
      transfer: {isVisible: false, isEnabled: false},
      consult: {isVisible: false, isEnabled: false},
      consultTransfer: {isVisible: false, isEnabled: false},
      endConsult: {isVisible: false, isEnabled: false},
      recording: {isVisible: false, isEnabled: false},
      conference: {isVisible: false, isEnabled: false},
      wrapup: {isVisible: false, isEnabled: false},
      exitConference: {isVisible: false, isEnabled: false},
      transferConference: {isVisible: false, isEnabled: false},
      mergeToConference: {isVisible: false, isEnabled: false},
      switchToMainCall: {isVisible: false, isEnabled: false},
      switchToConsult: {isVisible: false, isEnabled: false},
      },
      ...overrides,
  } as TaskContext);

  const createParams = (context: TaskContext, event?: TaskEventPayload): GuardParams => ({
    context,
    event,
  });

  const createEventWithTaskData = (taskData: TaskData): TaskEventPayload =>
    ({taskData} as TaskEventPayload);

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
    it('conferenceInProgressFromEvent returns true with 2+ agents in event', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
            participants: {
            a1: createParticipant('a1', 'Agent'),
            a2: createParticipant('a2', 'Agent'),
            },
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['a1', 'a2'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      expect(guards.conferenceInProgressFromEvent(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('conferenceInProgressFromEvent returns false with 1 agent', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          participants: {
            a1: createParticipant('a1', 'Agent'),
          },
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['a1'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      expect(guards.conferenceInProgressFromEvent(createParams(ctx, createEventWithTaskData(taskData)))).toBe(false);
    });

    it('notInConferenceFromEvent returns true with <2 agents', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          participants: {
            a1: createParticipant('a1', 'Agent'),
          },
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['a1'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      expect(guards.notInConferenceFromEvent(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('shouldDowngradeConference returns true with <2 agents in event', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          participants: {
            a1: createParticipant('a1', 'Agent'),
          },
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['a1'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      expect(guards.shouldDowngradeConference(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('conferenceActiveAndNotWrappingAndNotExiting returns true when in conference and not exiting', () => {
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          owner: 'other-agent', // Not the owner, so shouldn't wrap up
          participants: {
            a1: createParticipant('a1', 'Agent'),
            a2: createParticipant('a2', 'Agent'),
          },
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['a1', 'a2'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      const ctx = createContext({exitingConference: false, taskData});
      expect(guards.conferenceActiveAndNotWrappingAndNotExiting(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('isExitingConference returns context value', () => {
      expect(guards.isExitingConference(createParams(createContext({exitingConference: true})))).toBe(true);
      expect(guards.isExitingConference(createParams(createContext({exitingConference: false})))).toBe(false);
    });
  });

  describe('Consult Guards', () => {
    it('isConsultInitiator returns context value', () => {
      expect(guards.isConsultInitiator(createParams(createContext({consultInitiator: true})))).toBe(true);
      expect(guards.isConsultInitiator(createParams(createContext({consultInitiator: false})))).toBe(false);
    });

    it('isNotConsultInitiator returns inverse of consultInitiator', () => {
      expect(guards.isNotConsultInitiator(createParams(createContext({consultInitiator: true})))).toBe(false);
      expect(guards.isNotConsultInitiator(createParams(createContext({consultInitiator: false})))).toBe(true);
    });

    it('didInitiateConsult returns true when consultingAgentId matches', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        consultingAgentId: 'agent-123',
        isConsulted: false,
      });
      expect(guards.didInitiateConsult(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('didInitiateConsult returns false when isConsulted is true', () => {
      const ctx = createContext();
      const taskData = createTaskData({isConsulted: true});
      expect(guards.didInitiateConsult(createParams(ctx, createEventWithTaskData(taskData)))).toBe(false);
    });
  });

  describe('Wrap-up Guards', () => {
    it('shouldWrapUp returns true for owner', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          owner: 'agent-123',
          },
      });
      expect(guards.shouldWrapUp(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('shouldWrapUp returns false for non-owner', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          owner: 'other-agent',
        },
      });
      expect(guards.shouldWrapUp(createParams(ctx, createEventWithTaskData(taskData)))).toBe(false);
    });

    it('shouldWrapUp returns true when agentsPendingWrapUp includes agent', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        agentsPendingWrapUp: ['agent-123', 'other-agent'],
      } as Partial<TaskData>);
      expect(guards.shouldWrapUp(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('shouldWrapUp uses isConsulted fallback when no owner', () => {
      const taskData = createTaskData({
        isConsulted: false,
        interaction: {
          ...createTaskData().interaction,
          owner: undefined as unknown as string, // No owner
          },
      });
      const ctx = createContext({taskData});
      expect(guards.shouldWrapUp(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });
  });

  describe('Server State Guards', () => {
    it('serverReportsHeld returns true when media isHold is true', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['agent-123'],
              mType: 'mainCall',
              isHold: true,
              holdTimestamp: Date.now(),
            },
          },
        },
      });
      expect(guards.serverReportsHeld(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('serverReportsHeld returns false when media isHold is false', () => {
      const ctx = createContext();
      const taskData = createTaskData({
          interaction: {
          ...createTaskData().interaction,
          media: {
            [INTERACTION_ID]: {
              mediaResourceId: INTERACTION_ID,
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['agent-123'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      expect(guards.serverReportsHeld(createParams(ctx, createEventWithTaskData(taskData)))).toBe(false);
    });

    it('serverReportsConsulting returns true when isConsulted is true', () => {
      const ctx = createContext({consultInitiator: false});
      const taskData = createTaskData({isConsulted: true});
      expect(guards.serverReportsConsulting(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });

    it('serverReportsConsulting returns true when consultInitiator and not wrapping up', () => {
      const ctx = createContext({consultInitiator: true});
      const taskData = createTaskData({wrapUpRequired: false});
      expect(guards.serverReportsConsulting(createParams(ctx, createEventWithTaskData(taskData)))).toBe(true);
    });
  });
});

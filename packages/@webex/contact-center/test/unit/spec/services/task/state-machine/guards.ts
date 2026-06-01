import {guards, GuardParams} from '../../../../../../src/services/task/state-machine/guards';
import {
  TaskContext,
  TaskEventPayload,
} from '../../../../../../src/services/task/state-machine/types';
import {TaskData, InteractionParticipant} from '../../../../../../src/services/task/types';

describe('State Machine Guards', () => {
  const createParticipant = (
    id: string,
    pType: string,
    hasLeft = false
  ): InteractionParticipant => ({
    id,
    pType,
    type: pType,
    hasJoined: true,
    hasLeft,
    isInPredial: false,
  });
  // Note: media key must match mainInteractionId for getIsConferenceInProgress to work
  const INTERACTION_ID = 'interaction-123';

  const createTaskData = (overrides: Partial<TaskData> = {}): TaskData =>
    ({
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

  const createContext = (overrides: Partial<TaskContext> = {}): TaskContext =>
    ({
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
        main: {
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
          switch: {isVisible: false, isEnabled: false},
          mute: {isVisible: false, isEnabled: false},
        },
        consult: {
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
          switch: {isVisible: false, isEnabled: false},
          mute: {isVisible: false, isEnabled: false},
        },
        activeLeg: 'main',
      },
      ...overrides,
    } as TaskContext);

  const createParams = (context: TaskContext, event?: TaskEventPayload): GuardParams => ({
    context,
    event,
  });

  const createEventWithTaskData = (taskData: TaskData): TaskEventPayload =>
    ({taskData} as TaskEventPayload);

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
      expect(
        guards.conferenceInProgressFromEvent(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(true);
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
      expect(
        guards.conferenceInProgressFromEvent(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(false);
    });
  });

  describe('Consult Guards', () => {
    it('didInitiateConsult returns true when consultingAgentId matches', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        consultingAgentId: 'agent-123',
        isConsulted: false,
      });
      expect(guards.didInitiateConsult(createParams(ctx, createEventWithTaskData(taskData)))).toBe(
        true
      );
    });

    it('didInitiateConsult returns false when isConsulted is true', () => {
      const ctx = createContext();
      const taskData = createTaskData({isConsulted: true});
      expect(guards.didInitiateConsult(createParams(ctx, createEventWithTaskData(taskData)))).toBe(
        false
      );
    });

    it('isInteractionConsulting returns true for pending self consult on hydrate', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        isConsulted: false,
        interaction: {
          ...createTaskData().interaction,
          state: 'conference',
          participants: {
            'agent-123': {
              ...createParticipant('agent-123', 'Agent'),
              consultState: 'consultInitiated',
              isConsulted: false,
            },
            'agent-456': {
              ...createParticipant('agent-456', 'Agent'),
              hasJoined: false,
              consultState: 'consultReserved',
              isConsulted: true,
            },
          },
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
            'consult-media': {
              mediaResourceId: 'consult-media',
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['agent-123', 'agent-456'],
              mType: 'consult',
              isHold: false,
              holdTimestamp: null,
            },
          },
        } as any,
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(true);
    });

    it('isInteractionConsulting returns false for consulted agent pending consult state', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        isConsulted: true,
        interaction: {
          ...createTaskData().interaction,
          state: 'conference',
          participants: {
            'agent-123': {
              ...createParticipant('agent-123', 'Agent'),
              consultState: 'consultInitiated',
              isConsulted: true,
            },
          },
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
            'consult-media': {
              mediaResourceId: 'consult-media',
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['agent-123'],
              mType: 'consult',
              isHold: false,
              holdTimestamp: null,
            },
          },
        } as any,
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(false);
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

  describe('Hydration Guards - isInteractionConsulting', () => {
    it('returns true when interaction state is consulting', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        interaction: {
          ...createTaskData().interaction,
          state: 'consulting',
        },
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(true);
    });

    it('returns true for EP_DN consulted agent (state=connected, CPD relationshipType=consult)', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        interaction: {
          ...createTaskData().interaction,
          state: 'connected',
          callProcessingDetails: {
            ...createTaskData().interaction!.callProcessingDetails,
            relationshipType: 'consult',
          },
        },
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(true);
    });

    it('returns true when post_call with active consult (consultState=consulting + consult media)', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        interaction: {
          ...createTaskData().interaction,
          state: 'post_call',
          participants: {
            'agent-123': {
              ...createParticipant('agent-123', 'Agent'),
              consultState: 'consulting',
            },
          },
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
            'consult-media': {
              mediaResourceId: 'consult-media',
              mediaType: 'telephony',
              mediaMgr: 'media-mgr',
              participants: ['agent-123', 'agent-2'],
              mType: 'consult',
              isHold: false,
              holdTimestamp: null,
            },
          },
        },
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(true);
    });

    it('returns false for post_call without consult media', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        interaction: {
          ...createTaskData().interaction,
          state: 'post_call',
          participants: {
            'agent-123': {
              ...createParticipant('agent-123', 'Agent'),
              consultState: undefined,
            },
          },
        },
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(false);
    });

    it('returns false for plain connected state without consult CPD', () => {
      const ctx = createContext();
      const taskData = createTaskData({
        interaction: {
          ...createTaskData().interaction,
          state: 'connected',
        },
      });
      expect(
        guards.isInteractionConsulting(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(false);
    });
  });

  describe('Server State Guards', () => {
    it('isPrimaryMediaOnHold returns true when media isHold is true', () => {
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
      expect(
        guards.isPrimaryMediaOnHold(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(true);
    });

    it('isPrimaryMediaOnHold returns false when media isHold is false', () => {
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
      expect(
        guards.isPrimaryMediaOnHold(createParams(ctx, createEventWithTaskData(taskData)))
      ).toBe(false);
    });
  });
});

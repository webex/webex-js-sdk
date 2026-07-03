import {MEDIA_CHANNEL, TaskData} from '../../../../../src/services/task/types';

type TaskDataOverrides = Partial<TaskData> & {
  interaction?: Partial<TaskData['interaction']> & {
    media?: Record<string, {mediaResourceId: string; isHold: boolean}>;
    callProcessingDetails?: Record<string, any>;
  };
};

/**
 * Utility to create task data for tests with sensible defaults while allowing overrides.
 */
export function createTaskData(overrides: TaskDataOverrides = {}): TaskData {
  const base: TaskData = {
    interactionId: 'interaction-1',
    mediaResourceId: 'media-1',
    eventType: 'OFFER',
    agentId: 'agent-1',
    destAgentId: 'agent-2',
    trackingId: 'tracking-1',
    consultMediaResourceId: 'media-1',
    interaction: {
      isFcManaged: false,
      isTerminated: false,
      mediaType: MEDIA_CHANNEL.TELEPHONY,
      previousVTeams: [],
      state: 'new',
      currentVTeam: 'team-1',
      participants: [],
      interactionId: 'interaction-1',
      orgId: 'org-1',
      callProcessingDetails: {
        recordingStarted: true,
        recordInProgress: true,
      },
      media: {
        'media-1': {
          mediaResourceId: 'media-1',
          isHold: false,
        },
      },
    } as any,
  } as TaskData;

  const mergedInteraction = {
    ...(base.interaction as any),
    ...(overrides.interaction || {}),
    media: {
      ...((base.interaction as any).media || {}),
      ...((overrides.interaction as any)?.media || {}),
    },
    callProcessingDetails: {
      ...((base.interaction as any).callProcessingDetails || {}),
      ...((overrides.interaction as any)?.callProcessingDetails || {}),
    },
  };

  return {
    ...base,
    ...overrides,
    interaction: mergedInteraction,
  } as TaskData;
}

describe('taskTestUtils', () => {
  it('creates sensible defaults when no overrides are provided', () => {
    const task = createTaskData();

    expect(task.interactionId).toBe('interaction-1');
    expect(task.interaction?.state).toBe('new');
    expect(task.interaction?.media?.['media-1']?.isHold).toBe(false);
  });

  it('merges nested interaction overrides', () => {
    const task = createTaskData({
      interaction: {
        state: 'connected',
        media: {
          'media-1': {mediaResourceId: 'media-1', isHold: true},
        },
      },
    });

    expect(task.interaction?.state).toBe('connected');
    expect(task.interaction?.media?.['media-1']?.isHold).toBe(true);
  });
});

import {
  shouldBridgeChannelState,
  projectAggregate,
  bridgeStateChangeSuccess,
  buildAgentStateChangeEvent,
} from '../../../../../src/services/agent/utils';
import {AgentChannelTypeStates, ChannelType} from '../../../../../src/services/agent/types';

function makeChannelState(
  agentState: string,
  overrides: Partial<AgentChannelTypeStates> = {}
): AgentChannelTypeStates {
  return {
    agentState,
    pendingIdle: false,
    auxCodeId: 'aux-001',
    availableChannelCount: 1,
    totalChannelCount: 1,
    stateChangeReason: 'test',
    stateChangeTimestamp: 1000000,
    ...overrides,
  };
}

describe('utils – V1 bridge functions', () => {
  describe('shouldBridgeChannelState', () => {
    it('should return true for Available', () => {
      expect(shouldBridgeChannelState('Available')).toBe(true);
    });

    it('should return true for Idle', () => {
      expect(shouldBridgeChannelState('Idle')).toBe(true);
    });

    it('should return false for Engaged', () => {
      expect(shouldBridgeChannelState('Engaged')).toBe(false);
    });

    it('should return false for Reserved', () => {
      expect(shouldBridgeChannelState('Reserved')).toBe(false);
    });

    it('should return false for WrapUp', () => {
      expect(shouldBridgeChannelState('WrapUp')).toBe(false);
    });

    it('should return false for LoggedOut', () => {
      expect(shouldBridgeChannelState('LoggedOut')).toBe(false);
    });

    it('should return false for unknown states', () => {
      expect(shouldBridgeChannelState('SomeRandomState')).toBe(false);
    });
  });

  describe('projectAggregate', () => {
    it('should return Available when any channel is Available', () => {
      const states = {
        telephony: makeChannelState('Available'),
        chat: makeChannelState('Idle'),
      };
      const result = projectAggregate(states);

      expect(result).not.toBeNull();
      expect(result!.subStatus).toBe('Available');
    });

    it('should return Idle when all channels are Idle', () => {
      const states = {
        telephony: makeChannelState('Idle'),
        chat: makeChannelState('Idle'),
      };
      const result = projectAggregate(states);

      expect(result).not.toBeNull();
      expect(result!.subStatus).toBe('Idle');
    });

    it('should return null when no channels have bridgeable states', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
        chat: makeChannelState('Reserved'),
      };
      const result = projectAggregate(states);

      expect(result).toBeNull();
    });

    it('should return null for empty channel states', () => {
      const result = projectAggregate({});

      expect(result).toBeNull();
    });

    it('should take scalar fields from the channel that matches the projected subStatus', () => {
      const states = {
        chat: makeChannelState('Available', {auxCodeId: 'aux-chat'}),
        telephony: makeChannelState('Idle', {auxCodeId: 'aux-lunch'}),
      };
      const result = projectAggregate(states);

      expect(result!.subStatus).toBe('Available');
      expect(result!.primaryChannel).toBe('chat');
    });

    it('should select chat when telephony is not bridgeable', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
        chat: makeChannelState('Available'),
        email: makeChannelState('Idle'),
      };
      const result = projectAggregate(states);

      expect(result!.primaryChannel).toBe('chat');
      expect(result!.subStatus).toBe('Available');
    });

    it('should handle mixed Available and non-bridgeable states', () => {
      const states = {
        telephony: makeChannelState('WrapUp'),
        chat: makeChannelState('Reserved'),
        email: makeChannelState('Available'),
      };
      const result = projectAggregate(states);

      expect(result!.subStatus).toBe('Available');
      expect(result!.primaryChannel).toBe('email');
    });

    it('should return null when Idle channels exist but a channel is Engaged', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
        chat: makeChannelState('Idle'),
      };
      const result = projectAggregate(states);

      expect(result).toBeNull();
    });

    it('should return null when Idle channels exist but a channel is in WrapUp', () => {
      const states = {
        telephony: makeChannelState('WrapUp'),
        chat: makeChannelState('Idle'),
        email: makeChannelState('Idle'),
      };
      const result = projectAggregate(states);

      expect(result).toBeNull();
    });

    it('should return Available when Available and non-bridgeable both exist', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
        chat: makeChannelState('Available'),
      };
      const result = projectAggregate(states);

      expect(result!.subStatus).toBe('Available');
      expect(result!.primaryChannel).toBe('chat');
    });
  });

  describe('bridgeStateChangeSuccess', () => {
    const agentId = 'agent-123';
    const agentSessionId = 'session-456';
    const orgId = 'org-789';

    it('should create correct V1 shape for Available aggregate', () => {
      const states = {
        telephony: makeChannelState('Available', {
          auxCodeId: 'aux-avail',
          stateChangeTimestamp: 1234567890,
          stateChangeReason: 'user request',
        }),
      };

      const result = bridgeStateChangeSuccess(states, agentId, agentSessionId, orgId);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('AgentStateChangeSuccess');
      expect(result!.agentId).toBe(agentId);
      expect(result!.agentSessionId).toBe(agentSessionId);
      expect(result!.orgId).toBe(orgId);
      expect(result!.status).toBe('LoggedIn');
      expect(result!.subStatus).toBe('Available');
      expect(result!.auxCodeId).toBe('aux-avail');
      expect(result!.lastStateChangeTimestamp).toBe(1234567890);
      expect(result!.lastStateChangeReason).toBe('user request');
    });

    it('should create V1 shape for Idle aggregate', () => {
      const states = {
        telephony: makeChannelState('Idle'),
        chat: makeChannelState('Idle'),
      };

      const result = bridgeStateChangeSuccess(states, agentId, agentSessionId, orgId);

      expect(result!.subStatus).toBe('Idle');
    });

    it('should return null when no channels are bridgeable', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
      };

      const result = bridgeStateChangeSuccess(states, agentId, agentSessionId, orgId);

      expect(result).toBeNull();
    });

    it('should return null for empty channel states', () => {
      const result = bridgeStateChangeSuccess({}, agentId, agentSessionId, orgId);

      expect(result).toBeNull();
    });

    it('should include changedBy fields as null when no attribution is provided', () => {
      const states = {
        telephony: makeChannelState('Available'),
      };

      const result = bridgeStateChangeSuccess(states, agentId, agentSessionId, orgId);

      expect(result!.changedBy).toBeNull();
      expect(result!.changedById).toBeNull();
      expect(result!.changedByName).toBeNull();
    });

    it('should forward attribution fields when provided', () => {
      const states = {
        telephony: makeChannelState('Available'),
      };
      const attribution = {
        changedBy: 'supervisor',
        changedById: 'sup-001',
        changedByName: 'Jane Doe',
      };

      const result = bridgeStateChangeSuccess(states, agentId, agentSessionId, orgId, attribution);

      expect(result!.changedBy).toBe('supervisor');
      expect(result!.changedById).toBe('sup-001');
      expect(result!.changedByName).toBe('Jane Doe');
    });

    it('should use null for missing attribution fields', () => {
      const states = {
        telephony: makeChannelState('Available'),
      };

      const result = bridgeStateChangeSuccess(states, agentId, agentSessionId, orgId, {
        changedBy: 'agent',
      });

      expect(result!.changedBy).toBe('agent');
      expect(result!.changedById).toBeNull();
      expect(result!.changedByName).toBeNull();
    });
  });

  describe('buildAgentStateChangeEvent', () => {
    const agentId = 'agent-1';
    const agentSessionId = 'session-1';
    const orgId = 'org-1';
    const attribution = {changedBy: 'agent', changedById: 'agent-1', changedByName: 'Agent One'};

    function makeEnrichment(
      channelStates: Record<string, AgentChannelTypeStates>,
      changedChannelType: ChannelType = 'telephony',
      changedChannels: ChannelType[] = [changedChannelType]
    ) {
      return {
        channelStates: channelStates as Record<ChannelType, AgentChannelTypeStates>,
        changedChannelType,
        channelDetail: channelStates[changedChannelType],
        requestTrackingId: 'track-001',
        changedChannels,
      };
    }

    it('should return enriched payload with V1 base when aggregate is bridgeable (Available)', () => {
      const states = {
        telephony: makeChannelState('Available', {auxCodeId: 'aux-avail', stateChangeTimestamp: 9999}),
        chat: makeChannelState('Available', {auxCodeId: 'aux-avail'}),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution, makeEnrichment(states)
      );

      expect(result.type).toBe('AgentStateChangeSuccess');
      expect(result.subStatus).toBe('Available');
      expect(result.auxCodeId).toBe('aux-avail');

      expect(result.changedChannelType).toBe('telephony');
      expect(result.changedChannels).toEqual(['telephony']);
      expect(result.channelStates).toBeDefined();
      expect(result.requestTrackingId).toBe('track-001');
      expect(result.changedBy).toBe('agent');
    });

    it('should return enriched payload with V1 base when aggregate is bridgeable (all Idle)', () => {
      const states = {
        telephony: makeChannelState('Idle', {auxCodeId: 'break-1'}),
        chat: makeChannelState('Idle', {auxCodeId: 'break-1'}),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution,
        makeEnrichment(states, 'chat', ['telephony', 'chat'])
      );

      expect(result.subStatus).toBe('Idle');

      expect(result.changedChannelType).toBe('chat');
      expect(result.changedChannels).toEqual(['telephony', 'chat']);
    });

    it('should return fallback payload when aggregate is NOT bridgeable (Engaged)', () => {
      const states = {
        telephony: makeChannelState('Engaged', {
          auxCodeId: '',
          stateChangeTimestamp: 5000,
          stateChangeReason: 'task accepted',
        }),
        chat: makeChannelState('Idle', {auxCodeId: 'break-1'}),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution, makeEnrichment(states)
      );

      // Non-bridgeable: V1 subStatus defaults to 'Idle'
      expect(result.type).toBe('AgentStateChangeSuccess');
      expect(result.subStatus).toBe('Idle');

      expect(result.changedChannelType).toBe('telephony');
      expect(result.channelDetail?.agentState).toBe('Engaged');
      expect(result.channelStates).toBeDefined();
      expect(result.requestTrackingId).toBe('track-001');
    });

    it('should return fallback payload for Reserved state (non-bridgeable)', () => {
      const states = {
        telephony: makeChannelState('Reserved', {
          stateChangeTimestamp: 7000,
          stateChangeReason: 'incoming task',
        }),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, undefined, makeEnrichment(states)
      );

      expect(result.subStatus).toBe('Idle');

      expect(result.channelDetail?.agentState).toBe('Reserved');
      expect(result.changedBy).toBeNull();
    });

    it('should return fallback payload for WrapUp state (non-bridgeable)', () => {
      const states = {
        chat: makeChannelState('WrapUp', {
          stateChangeTimestamp: 8000,
          stateChangeReason: 'task ended',
        }),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution,
        makeEnrichment(states, 'chat')
      );

      expect(result.subStatus).toBe('Idle');

      expect(result.channelDetail?.agentState).toBe('WrapUp');
    });

    it('should never return null — always produces a payload', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
        chat: makeChannelState('Reserved'),
        email: makeChannelState('WrapUp'),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, undefined, makeEnrichment(states)
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('AgentStateChangeSuccess');

    });

    it('should populate multi-channel changedChannels correctly', () => {
      const states = {
        telephony: makeChannelState('Idle', {auxCodeId: 'break-1'}),
        chat: makeChannelState('Idle', {auxCodeId: 'break-1'}),
        email: makeChannelState('Idle', {auxCodeId: 'break-1'}),
        social: makeChannelState('Idle', {auxCodeId: 'break-1'}),
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution,
        makeEnrichment(states, 'social', ['telephony', 'chat', 'email', 'social'])
      );

      expect(result.changedChannels).toEqual(['telephony', 'chat', 'email', 'social']);
      expect(result.changedChannelType).toBe('social');
    });

    it('should omit requestTrackingId when not provided', () => {
      const states = {telephony: makeChannelState('Available')};
      const enrichment = {
        channelStates: states as Record<ChannelType, AgentChannelTypeStates>,
        changedChannelType: 'telephony' as ChannelType,
        channelDetail: states.telephony,
        changedChannels: ['telephony'] as ChannelType[],
      };

      const result = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution, enrichment
      );

      expect(result.requestTrackingId).toBeUndefined();
    });

    it('should not include isGranular in the payload (removed — clients check channelStates instead)', () => {
      const states = {
        telephony: makeChannelState('Available', {auxCodeId: 'aux-avail'}),
        chat: makeChannelState('Idle', {auxCodeId: 'break-1'}),
      };

      const bridgeable = buildAgentStateChangeEvent(
        states, agentId, agentSessionId, orgId, attribution, makeEnrichment(states)
      );
      expect(bridgeable).not.toHaveProperty('isGranular');

      const nonBridgeable = buildAgentStateChangeEvent(
        {telephony: makeChannelState('Engaged')},
        agentId, agentSessionId, orgId, attribution,
        makeEnrichment({telephony: makeChannelState('Engaged')})
      );
      expect(nonBridgeable).not.toHaveProperty('isGranular');
    });
  });

});

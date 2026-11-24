import {
  shouldBridgeChannelState,
  projectAggregate,
  bridgeStateChangeSuccess,
  shouldEmitLegacyEvent,
} from '../../../../../src/services/agent/utils';
import {AgentChannelTypeStates} from '../../../../../src/services/agent/types';

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

  describe('shouldEmitLegacyEvent', () => {
    it('should return true when projected state differs from last emitted', () => {
      const states = {
        telephony: makeChannelState('Available'),
      };

      expect(shouldEmitLegacyEvent(states, {subStatus: 'Idle', auxCodeId: 'aux-001'})).toBe(true);
    });

    it('should return false when projected state equals last emitted', () => {
      const states = {
        telephony: makeChannelState('Available'),
      };

      expect(shouldEmitLegacyEvent(states, {subStatus: 'Available', auxCodeId: 'aux-001'})).toBe(false);
    });

    it('should return true when the idle code changes at the same subStatus', () => {
      const states = {
        telephony: makeChannelState('Idle', {auxCodeId: 'aux-lunch'}),
      };

      expect(shouldEmitLegacyEvent(states, {subStatus: 'Idle', auxCodeId: 'aux-break'})).toBe(true);
    });

    it('should return true when last emitted is undefined and state is bridgeable', () => {
      const states = {
        telephony: makeChannelState('Idle'),
      };

      expect(shouldEmitLegacyEvent(states, undefined)).toBe(true);
    });

    it('should return false when no channels are bridgeable', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
      };

      expect(shouldEmitLegacyEvent(states, {subStatus: 'Available'})).toBe(false);
    });

    it('should return false for empty channel states', () => {
      expect(shouldEmitLegacyEvent({}, undefined)).toBe(false);
    });

    it('should return false when Idle channels exist but a non-bridgeable channel prevents projection', () => {
      const states = {
        telephony: makeChannelState('Engaged'),
        chat: makeChannelState('Idle'),
      };

      expect(shouldEmitLegacyEvent(states, {subStatus: 'Available', auxCodeId: 'aux-001'})).toBe(false);
    });
  });
});

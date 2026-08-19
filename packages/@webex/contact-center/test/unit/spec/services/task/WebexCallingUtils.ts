import {expect} from '@jest/globals';
import {
  getWebexCallingDeviceDetailsForAgent,
  isWebexCallingCallForAgent,
  isWxAppEngagedForControls,
  decodedLineOwnerId,
} from '../../../../../src/services/task/WebexCallingUtils';
import {TaskState} from '../../../../../src/services/task/state-machine/constants';

const WX_APP_PARTICIPANT = {
  id: 'agent-1',
  deviceType: 'wxApp',
  deviceId: 'device-id-1',
  deviceCallId: 'call-id-1',
};

const participantsById = {
  'agent-1': WX_APP_PARTICIPANT,
  'customer-1': {id: 'customer-1', pType: 'Customer'},
};

describe('getWebexCallingDeviceDetailsForAgent', () => {
  it('returns device details when agent participant has wxApp deviceType', () => {
    const result = getWebexCallingDeviceDetailsForAgent('agent-1', participantsById);

    expect(result).toEqual({
      deviceType: 'wxApp',
      deviceId: 'device-id-1',
      deviceCallId: 'call-id-1',
    });
  });

  it('returns undefined when agentId is undefined', () => {
    expect(getWebexCallingDeviceDetailsForAgent(undefined, participantsById)).toBeUndefined();
  });

  it('returns undefined when agentId is empty string', () => {
    expect(getWebexCallingDeviceDetailsForAgent('', participantsById)).toBeUndefined();
  });

  it('returns undefined when participants is null', () => {
    expect(getWebexCallingDeviceDetailsForAgent('agent-1', null)).toBeUndefined();
  });

  it('returns undefined when participants is an array (not object-by-id)', () => {
    expect(getWebexCallingDeviceDetailsForAgent('agent-1', [WX_APP_PARTICIPANT])).toBeUndefined();
  });

  it('returns undefined when agent participant lacks deviceCallId', () => {
    const participants = {
      'agent-1': {id: 'agent-1', deviceType: 'wxApp', deviceId: 'device-id-1'},
    };

    expect(getWebexCallingDeviceDetailsForAgent('agent-1', participants)).toBeUndefined();
  });

  it('returns undefined when agent participant lacks deviceId', () => {
    const participants = {
      'agent-1': {id: 'agent-1', deviceType: 'wxApp', deviceCallId: 'call-id-1'},
    };

    expect(getWebexCallingDeviceDetailsForAgent('agent-1', participants)).toBeUndefined();
  });

  it('finds participant by id field when keyed differently', () => {
    const participants = {
      'some-other-key': WX_APP_PARTICIPANT,
    };
    const result = getWebexCallingDeviceDetailsForAgent('agent-1', participants);

    expect(result?.deviceCallId).toBe('call-id-1');
  });

  it('defaults deviceType to empty string when missing', () => {
    const participants = {
      'agent-1': {id: 'agent-1', deviceId: 'device-id-1', deviceCallId: 'call-id-1'},
    };
    const result = getWebexCallingDeviceDetailsForAgent('agent-1', participants);

    expect(result?.deviceType).toBe('');
  });
});

describe('isWebexCallingCallForAgent', () => {
  it('returns true when device details are found', () => {
    expect(isWebexCallingCallForAgent('agent-1', participantsById)).toBe(true);
  });

  it('returns false when no device details are found', () => {
    expect(isWebexCallingCallForAgent('unknown-agent', participantsById)).toBe(false);
  });

  it('returns false when agentId is undefined', () => {
    expect(isWebexCallingCallForAgent(undefined, participantsById)).toBe(false);
  });
});

describe('isWxAppEngagedForControls', () => {
  it('returns true when flag is on, wxApp participant exists, and state is CONNECTED', () => {
    expect(
      isWxAppEngagedForControls(true, 'agent-1', participantsById, TaskState.CONNECTED)
    ).toBe(true);
  });

  it('returns false in OFFERED state', () => {
    expect(isWxAppEngagedForControls(true, 'agent-1', participantsById, TaskState.OFFERED)).toBe(
      false
    );
  });

  it('returns false when enableAnswerOnWebex is false', () => {
    expect(
      isWxAppEngagedForControls(false, 'agent-1', participantsById, TaskState.CONNECTED)
    ).toBe(false);
  });

  it('returns false in TERMINATED state', () => {
    expect(
      isWxAppEngagedForControls(true, 'agent-1', participantsById, TaskState.TERMINATED)
    ).toBe(false);
  });

  it('returns false in COMPLETED state', () => {
    expect(
      isWxAppEngagedForControls(true, 'agent-1', participantsById, TaskState.COMPLETED)
    ).toBe(false);
  });
});

describe('decodedLineOwnerId', () => {
  it('returns undefined when lineOwnerId is not provided', () => {
    expect(decodedLineOwnerId(undefined)).toBeUndefined();
    expect(decodedLineOwnerId('')).toBeUndefined();
  });

  it('decodes base64 encoded ID and returns last path segment', () => {
    const orgId = 'ciscospark://us/ORGANIZATION/org-abc';
    const encoded = btoa(orgId);
    const result = decodedLineOwnerId(encoded);

    expect(result).toBe('org-abc');
  });

  it('returns undefined when base64 decoding fails', () => {
    expect(decodedLineOwnerId('not-valid-base64!!')).toBeUndefined();
  });
});

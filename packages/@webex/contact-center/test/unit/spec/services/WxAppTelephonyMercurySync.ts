import WxAppTelephonyMercurySync, {
  TELEPHONY_CALL_MUTED,
  TELEPHONY_CALL_UNMUTED,
} from '../../../../src/services/WxAppTelephonyMercurySync';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';

jest.mock('../../../../src/metrics/MetricsManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
}));

describe('WxAppTelephonyMercurySync', () => {
  const agentId = 'agent-123';
  const trackEvent = jest.fn();
  let mercury: {on: jest.Mock; off: jest.Mock};
  let webex: {internal: {mercury?: typeof mercury}};
  let sync: WxAppTelephonyMercurySync;
  let onMuteChange: jest.Mock;

  beforeEach(() => {
    trackEvent.mockClear();
    (MetricsManager.getInstance as jest.Mock).mockReturnValue({trackEvent});

    mercury = {on: jest.fn(), off: jest.fn()};
    webex = {internal: {mercury}};
    sync = new WxAppTelephonyMercurySync(webex as never);
    onMuteChange = jest.fn();
  });

  afterEach(() => {
    sync.unsubscribe();
  });

  it('subscribes to muted and unmuted Mercury events', () => {
    sync.subscribe(agentId, onMuteChange);

    expect(mercury.on).toHaveBeenCalledWith(TELEPHONY_CALL_MUTED, expect.any(Function));
    expect(mercury.on).toHaveBeenCalledWith(TELEPHONY_CALL_UNMUTED, expect.any(Function));
    expect(sync.isSubscribed()).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_SUCCESS,
      {},
      ['operational', 'behavioral']
    );
  });

  it('invokes callback with decoded callId and muted when actorId matches agent', () => {
    const callId = 'prefix:call-half-1';
    const encodedCallId = btoa(callId);
    const encodedActorId = btoa(`some-prefix-${agentId}`);

    sync.subscribe(agentId, onMuteChange);
    const muteHandler = mercury.on.mock.calls.find(([event]) => event === TELEPHONY_CALL_MUTED)![1];
    muteHandler({data: {actorId: encodedActorId, callId: encodedCallId, muted: true}});

    expect(onMuteChange).toHaveBeenCalledWith(callId, true);
  });

  it('ignores events when decoded actorId does not end with agentId', () => {
    sync.subscribe(agentId, onMuteChange);
    const muteHandler = mercury.on.mock.calls.find(([event]) => event === TELEPHONY_CALL_MUTED)![1];
    muteHandler({data: {actorId: btoa('other-agent'), callId: btoa('call-1'), muted: true}});

    expect(onMuteChange).not.toHaveBeenCalled();
  });

  it('ignores events with missing payload fields', () => {
    sync.subscribe(agentId, onMuteChange);
    const muteHandler = mercury.on.mock.calls.find(([event]) => event === TELEPHONY_CALL_MUTED)![1];
    muteHandler({data: {actorId: btoa(agentId), callId: btoa('call-1')}});

    expect(onMuteChange).not.toHaveBeenCalled();
  });

  it('unsubscribes and removes Mercury listeners', () => {
    sync.subscribe(agentId, onMuteChange);
    const muteHandler = mercury.on.mock.calls.find(([event]) => event === TELEPHONY_CALL_MUTED)![1];
    const unmuteHandler = mercury.on.mock.calls.find(
      ([event]) => event === TELEPHONY_CALL_UNMUTED
    )![1];

    sync.unsubscribe();

    expect(mercury.off).toHaveBeenCalledWith(TELEPHONY_CALL_MUTED, muteHandler);
    expect(mercury.off).toHaveBeenCalledWith(TELEPHONY_CALL_UNMUTED, unmuteHandler);
    expect(sync.isSubscribed()).toBe(false);
  });

  it('does not subscribe when mercury is unavailable', () => {
    sync = new WxAppTelephonyMercurySync({internal: {}} as never);
    sync.subscribe(agentId, onMuteChange);

    expect(sync.isSubscribed()).toBe(false);
    expect(onMuteChange).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED,
      expect.objectContaining({error: expect.stringContaining('Mercury is unavailable')}),
      ['operational', 'behavioral']
    );
  });

  it('invokes callback with muted false on unmuted Mercury event', () => {
    const callId = 'prefix:call-half-1';
    const encodedCallId = btoa(callId);
    const encodedActorId = btoa(`some-prefix-${agentId}`);

    sync.subscribe(agentId, onMuteChange);
    const unmuteHandler = mercury.on.mock.calls.find(
      ([event]) => event === TELEPHONY_CALL_UNMUTED
    )![1];
    unmuteHandler({data: {actorId: encodedActorId, callId: encodedCallId, muted: false}});

    expect(onMuteChange).toHaveBeenCalledWith(callId, false);
  });

  it('resubscribe replaces previous Mercury listeners', () => {
    sync.subscribe(agentId, onMuteChange);
    const firstMuteHandler = mercury.on.mock.calls.find(
      ([event]) => event === TELEPHONY_CALL_MUTED
    )![1];
    const firstUnmuteHandler = mercury.on.mock.calls.find(
      ([event]) => event === TELEPHONY_CALL_UNMUTED
    )![1];
    expect(mercury.on).toHaveBeenCalledTimes(2);

    const secondHandler = jest.fn();
    sync.subscribe(agentId, secondHandler);

    expect(mercury.off).toHaveBeenCalledWith(TELEPHONY_CALL_MUTED, firstMuteHandler);
    expect(mercury.off).toHaveBeenCalledWith(TELEPHONY_CALL_UNMUTED, firstUnmuteHandler);
    expect(mercury.on).toHaveBeenCalledTimes(4);
  });
});

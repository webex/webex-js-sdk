import MetricsManager from '../../../../../src/metrics/MetricsManager';
import routingAgent from '../../../../../src/services/agent';
import AqmReqs from '../../../../../src/services/core/aqm-reqs';
import {Details} from '../../../../../src/services/core/Err';
import {CC_EVENTS} from '../../../../../src/services/config/types';
import {HTTP_METHODS} from '../../../../../src/types';
import {WCC_API_GATEWAY} from '../../../../../src/services/constants';
import {createErrDetailsObject} from '../../../../../src/services/core/Utils';

jest.mock('../../../../../src/services/core/Utils', () => ({
  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
  normalizeRecoveryFailure: jest.requireActual('../../../../../src/services/core/Utils').normalizeRecoveryFailure,
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

describe('AQM routing agent', () => {
  let fakeAqm: jest.Mocked<AqmReqs>;
  let fakeMetricsManager: jest.Mocked<MetricsManager>;
  let agent: ReturnType<typeof routingAgent>;
  let dispatchState: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAqm = new AqmReqs() as jest.Mocked<AqmReqs>;
    fakeAqm.reqEmpty = jest.fn().mockImplementation((fn) => fn);
    fakeAqm.req = jest.fn().mockImplementation((fn) => jest.fn((...args) => fn(...args)));
    fakeMetricsManager = {
      trackEvent: jest.fn()
    } as unknown as jest.Mocked<MetricsManager>;
    fakeMetricsManager.trackEvent = jest.fn();

    agent = routingAgent(fakeAqm);
    dispatchState = fakeAqm.req.mock.results[0].value;
  });

  it('logout', async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'reqEmpty');
    reqSpy.mockRejectedValue(new Error('dasd'));
    const req = await agent.logout({data: {logoutReason: 'User requested logout'}});
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
  });

  it('reload', async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'reqEmpty');
    const req = await agent.reload();
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
  });

  it('stationLogin', async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'req');
    const req = await agent.stationLogin({data: {} as any});
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
  });

  it('stateChange forwards the payload, callback and context to its dispatcher by reference', async () => {
    const payload = {data: {state: 'Available', auxCodeId: '0'}};
    const callback = jest.fn();
    const context = {
      generation: 3,
      signal: new AbortController().signal,
      correlationId: '8f5ec5e4-80b8-4f5d-9720-10bfe56e7ca1',
      requireCorrelation: true,
    };
    const req = await agent.stateChange(payload, callback, context);

    expect(dispatchState).toHaveBeenCalledTimes(1);
    expect(dispatchState.mock.calls[0]).toHaveLength(3);
    expect(dispatchState.mock.calls[0][0]).toBe(payload);
    expect(dispatchState.mock.calls[0][1]).toBe(callback);
    expect(dispatchState.mock.calls[0][2]).toBe(context);
    expect(req).toBe(dispatchState.mock.results[0].value);
    expect(req).toEqual({
      kind: 'command',
      url: '/v1/agents/session/state',
      host: WCC_API_GATEWAY,
      data: payload.data,
      err: createErrDetailsObject,
      method: HTTP_METHODS.PUT,
      notifSuccess: {
        bind: {
          type: CC_EVENTS.AGENT_STATE_CHANGE,
          data: {type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS},
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.AGENT_STATE_CHANGE,
          data: {type: CC_EVENTS.AGENT_STATE_CHANGE_FAILED},
        },
        errId: 'Service.aqm.agent.stateChange',
      },
    });
  });
  it('stateChange accepts the ordinary payload without recovery arguments', async () => {
    const payload = {data: {state: 'Available', auxCodeId: '0'}};
    const req = await agent.stateChange(payload);

    expect(dispatchState.mock.calls).toEqual([[payload]]);
    expect(req.data).toBe(payload.data);
  });
  it('buddyAgents' , async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'req');
    const req = await agent.buddyAgents({data: {} as any});
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
  });

  it.each([
    {operation: 'reload', kind: 'session', data: {}},
    {
      operation: 'stationLogin', kind: 'session',
      data: {
        teamId: 'login-team', teamName: 'Login Team', siteId: 'login-site',
        dialNumber: '1001', usesOtherDN: false, auxCodeId: 'login-idle-code',
      },
    },
    {operation: 'logout', kind: 'teardown', data: {logoutReason: 'User requested logout'}},
    {
      operation: 'buddyAgents', kind: 'query',
      data: {agentProfileId: 'buddy-profile', mediaType: 'telephony', state: 'Available'},
    },
    {
      operation: 'stateChange', kind: 'command',
      data: {state: 'Idle', auxCodeId: 'state-idle-code', lastStateChangeReason: 'Lunch'},
    },
  ])('declares $operation operation kind $kind without changing its body', ({operation, kind, data}) => {
    const config = operation === 'reload' ? agent.reload() : agent[operation]({data});
    expect(config.kind).toBe(kind);
    expect(config.data).toStrictEqual(data);
  });

  it.each([
    {
      shape: 'fully populated HTTP error',
      failure: {
        statusCode: 503,
        body: {error: {reason: 'INTERNAL_ERROR', reasonCode: '1037'}},
        headers: {trackingid: 'WX_CC_SDK_full-request-id'},
        response: {data: {errorType: 'routing'}},
      },
      details: {
        status: 503, reason: 'INTERNAL_ERROR', reasonCode: 1037,
        trackingId: 'WX_CC_SDK_full-request-id', type: 'routing',
      },
    },
    {
      shape: 'opaque Error',
      failure: new Error('Opaque station login failure'),
      details: {status: 0, trackingId: '', type: undefined},
    },
    {
      shape: 'legacy response status and headers',
      failure: {response: {status: 502, headers: {trackingid: 'WX_CC_SDK_legacy-request-id'}}},
      details: {status: 502, trackingId: 'WX_CC_SDK_legacy-request-id', type: undefined},
    },
  ])('retains station HTTP diagnostics in the existing Err class for $shape', ({failure, details}) => {
    const config = agent.stationLogin({data: {} as any});
    const error = config.err(failure);
    expect(error).toBeInstanceOf(Details);
    expect(error.id).toBe('Service.aqm.agent.stationLogin');
    expect(error.details).toStrictEqual(details);
  });
});

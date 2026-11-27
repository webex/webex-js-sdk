import MetricsManager from '../../../../../src/metrics/MetricsManager';
import routingAgent, {
  getStationRecoveryFailureCategory,
} from '../../../../../src/services/agent';
import AqmReqs from '../../../../../src/services/core/aqm-reqs';
import {Details} from '../../../../../src/services/core/Err';

jest.mock('../../../../../src/services/core/Utils', () => ({
  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
  normalizeRecoveryFailure: jest.requireActual('../../../../../src/services/core/Utils').normalizeRecoveryFailure,
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

describe('station recovery failures', () => {
  it.each([
    [{reasonCode: 9999, status: 429}, 'transient'],
    [{reasonCode: 9999, status: 502}, 'transient'],
    [{reasonCode: 9999, status: 503}, 'transient'],
    [{reasonCode: 9999, reason: 'AGENT_NOT_FOUND'}, 'fallback'],
    [{reasonCode: 9999, reason: 'AGENT_DN_NOT_REGISTERED'}, 'fallback'],
    [{reasonCode: 9999, reason: 'AGENT_SESSION_ALREADY_EXISTS'}, 'exists'],
    [{reasonCode: 9999, reason: 'INTERNAL_ERROR'}, 'transient'],
    [{id: 'Service.aqm.reqs.Timeout'}, 'transient'],
    [{id: 'Service.aqm.reqs.TimeoutEvent'}, 'transient'],
    [{reasonCode: 9999, id: 'Timeout'}, 'transient'],
    [{reasonCode: 9999, id: 'TimeoutEvent'}, 'transient'],
    [{reasonCode: 1038, reason: 'INTERNAL_ERROR', status: 503}, 'fallback'],
    [{reasonCode: 1041}, 'fallback'],
    [{reasonCode: 9999, status: 400}, 'other'],
    [{reasonCode: 1037, reason: 'AGENT_NOT_FOUND'}, 'transient'],
    [{reasonCode: 1035, reason: 'AGENT_NOT_FOUND'}, 'exists'],
    [{reasonCode: 1037, status: 401}, 'auth'],
    [{reasonCode: 1035, status: 403}, 'auth'],
    [{reasonCode: 1037, reason: 'RECOVERY_INTERRUPTED', status: 403}, 'cancelled'],
  ])('classifies a recovery failure using the matching priority: %j', (failure, category) => {
    expect(getStationRecoveryFailureCategory(failure)).toBe(category);
  });
});

describe('AQM routing agent', () => {
  let fakeAqm: jest.Mocked<AqmReqs>;
  let fakeMetricsManager: jest.Mocked<MetricsManager>;
  let agent: ReturnType<typeof routingAgent>;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAqm = new AqmReqs() as jest.Mocked<AqmReqs>;
    fakeAqm.reqEmpty = jest.fn().mockImplementation((fn) => fn);
    fakeAqm.req = jest.fn().mockImplementation((fn) => fn);
    fakeMetricsManager = {
      trackEvent: jest.fn()
    } as unknown as jest.Mocked<MetricsManager>;
    fakeMetricsManager.trackEvent = jest.fn();

    agent = routingAgent(fakeAqm);
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

  it('stateChange', async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'req');
    const req = await agent.stateChange({data: {} as any});
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
  });
  it('buddyAgents', async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'req');
    const req = await agent.buddyAgents({data: {} as any});
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
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

import MetricsManager from '../../../../../src/metrics/MetricsManager';
import routingAgent from '../../../../../src/services/agent';
import AqmReqs from '../../../../../src/services/core/aqm-reqs';

jest.mock('../../../../../src/services/core/Utils', () => ({
  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

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

  it('reloadV2', async () => {
    const req = (agent.reloadV2 as unknown as () => {url: string; data: object})();
    expect(req.url).toBe('/v2/agents/reload');
    expect(req.data).toEqual({});
  });

  it('stationLoginV2', () => {
    const data = {teamId: 'team-1'} as any;
    const req = (agent.stationLoginV2 as unknown as (p: {data: object}) => any)({data});
    expect(req.url).toBe('/v2/agents/login');
    expect(req.data).toBe(data);
    expect(req.notifFail.errId).toBe('Service.aqm.agent.stationLoginV2Failed');
    expect(req.err({response: {status: 500, headers: {trackingid: 'x_t-1'}}}).id).toBe(
      'Service.aqm.agent.stationLoginV2'
    );
  });

  it('stateChangeV2', () => {
    const data = {state: 'Available', auxCodeIdArray: '0', channelType: ['chat']} as any;
    const req = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({data});
    expect(req.url).toBe('/v2/agents/session/state');
    expect(req.method).toBe('PUT');
    expect(req.data).toBe(data);
    expect(req.notifSuccess.bind.data.type).toBe('AgentChannelStateChanged');
    expect(req.notifFail.bind.data.type).toBe('AgentChannelStateChangeFailed');
    expect(req.notifFail.errId).toBe('Service.aqm.agent.stateChangeV2');
  });

  it('logoutV2', () => {
    const data = {logoutReason: 'User requested logout'};
    const req = (agent.logoutV2 as unknown as (p: {data: object}) => any)({data});
    expect(req.url).toBe('/v2/agents/logout');
    expect(req.method).toBeUndefined();
    expect(req.notifFail.errId).toBe('Service.aqm.agent.logoutV2');
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
});

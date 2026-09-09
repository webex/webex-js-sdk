import MetricsManager from '../../../../../src/metrics/MetricsManager';
import routingAgent, {createInternalRoutingAgent} from '../../../../../src/services/agent';
import AqmReqs from '../../../../../src/services/core/aqm-reqs';

jest.mock('../../../../../src/services/core/Utils', () => ({
  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

describe('AQM routing agent', () => {
  let fakeAqm: jest.Mocked<AqmReqs>;
  let fakeMetricsManager: jest.Mocked<MetricsManager>;
  let agent: ReturnType<typeof createInternalRoutingAgent>;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAqm = new AqmReqs() as jest.Mocked<AqmReqs>;
    fakeAqm.reqEmpty = jest.fn().mockImplementation((fn) => fn);
    fakeAqm.req = jest.fn().mockImplementation((fn) => fn);
    fakeMetricsManager = {
      trackEvent: jest.fn(),
    } as unknown as jest.Mocked<MetricsManager>;
    fakeMetricsManager.trackEvent = jest.fn();

    agent = createInternalRoutingAgent(fakeAqm);
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
  it('stateChangeV2 uses the Agent State Control route and notification bindings', async () => {
    const req = await agent.stateChangeV2({
      data: {channelType: ['telephony', 'chat'], state: 'Idle', auxCodeId: 'wellbeing-code'},
    });

    expect(req).toMatchObject({
      url: '/v2/agents/session/state',
      host: 'wcc-api-gateway',
      method: 'PUT',
      data: {
        channelType: ['telephony', 'chat'],
        state: 'Idle',
        auxCodeId: 'wellbeing-code',
      },
      notifSuccess: {
        bind: {
          type: ['AgentRequestEvent', 'RoutingMessage', 'AgentChannelStateChange'],
          data: {type: 'AgentChannelStateChanged'},
        },
      },
      notifFail: {
        bind: {
          type: 'AgentChannelStateChange',
          data: {type: 'AgentChannelStateChangeFailed'},
        },
      },
    });
  });
  it('does not expose stateChangeV2 from the public routing factory', () => {
    expect(routingAgent(fakeAqm)).not.toHaveProperty('stateChangeV2');
  });
  it('buddyAgents', async () => {
    const reqSpy = jest.spyOn(fakeAqm, 'req');
    const req = await agent.buddyAgents({data: {} as any});
    expect(req).toBeDefined();
    expect(reqSpy).toHaveBeenCalled();
  });
});

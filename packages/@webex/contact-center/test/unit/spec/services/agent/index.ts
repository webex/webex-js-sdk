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

  it('reload binds only V1 AgentReloginSuccess', () => {
    const req = (agent.reload as unknown as () => any)();
    expect(req.url).toBe('/v1/agents/reload');
    expect(req.notifSuccess.bind.type).toBe('AgentReloginSuccess');
    expect(req.notifSuccess.bind.data.type).toBe('AgentReloginSuccess');
  });

  it('reloadV2', async () => {
    const req = (agent.reloadV2 as unknown as () => {url: string; data: object})();
    expect(req.url).toBe('/v2/agents/reload');
    expect(req.data).toEqual({});
  });

  it('reloadV2 accepts both V1 and V2 relogin response types', () => {
    const req = (agent.reloadV2 as unknown as () => any)();
    expect(req.notifSuccess.bind.type).toEqual([
      'AgentReloginSuccess',
      'AgentChannelReloginSuccess',
    ]);
    expect(req.notifSuccess.bind.data.type).toEqual([
      'AgentReloginSuccess',
      'AgentChannelReloginSuccess',
    ]);
    expect(req.notifFail.bind.type).toBe('AgentReloginFailed');
    expect(req.notifFail.bind.data.type).toBe('AgentReloginFailed');
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

  it('stateChangeV2 correlates notifications to the requested channels', () => {
    const data = {state: 'Available', auxCodeId: '0', channelType: ['chat', 'voice']} as any;
    const req = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({data});
    expect(req.notifSuccess.bind.data.channelType).toEqual(['chat', 'voice']);
    expect(req.notifFail.bind.data.channelType).toEqual(['chat', 'voice']);
  });

  it('stateChangeV2 success bind includes isClientInitiated and agentId for correlation', () => {
    const data = {state: 'Available', auxCodeId: '0', channelType: ['chat'], agentId: 'agent-1'} as any;
    const req = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({data});

    expect(req.notifSuccess.bind.data.isClientInitiated).toBe(true);
    expect(req.notifSuccess.bind.data.agentId).toBe('agent-1');
    // Failure bind includes isClientInitiated to filter supervisor-visible
    // failures for other agents, but omits agentId because the wire contract
    // (AgentChannelStateChangeFailed) does not guarantee it.
    expect(req.notifFail.bind.data.isClientInitiated).toBe(true);
    expect(req.notifFail.bind.data.agentId).toBeUndefined();
  });

  it('stateChangeV2 omits agentId from bind when not provided', () => {
    const data = {state: 'Available', auxCodeId: '0', channelType: ['chat']} as any;
    const req = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({data});

    expect(req.notifSuccess.bind.data.isClientInitiated).toBe(true);
    expect(req.notifSuccess.bind.data.agentId).toBeUndefined();
  });

  it('stateChangeV2 success bind includes agentSessionId when provided', () => {
    const data = {state: 'Available', auxCodeId: '0', channelType: ['chat'], agentId: 'agent-1', agentSessionId: 'sess-1'} as any;
    const req = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({data});

    expect(req.notifSuccess.bind.data.agentSessionId).toBe('sess-1');
  });

  it('stateChangeV2 omits agentSessionId from bind when not provided', () => {
    const data = {state: 'Available', auxCodeId: '0', channelType: ['chat'], agentId: 'agent-1'} as any;
    const req = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({data});

    expect(req.notifSuccess.bind.data.agentSessionId).toBeUndefined();
  });

  it('stateChangeV2 success bind uses strict agentState match for non-Idle requests', () => {
    const availReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Available', auxCodeId: '0', channelType: ['chat']},
    });
    expect(availReq.notifSuccess.bind.data.agentChannelStateDetail).toEqual({agentState: 'Available'});
  });

  it('stateChangeV2 success bind uses __typeMap for Idle to accept pending confirmations', () => {
    const idleReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Idle', auxCodeId: 'aux-1', channelType: ['chat']},
    });
    const detail = idleReq.notifSuccess.bind.data.agentChannelStateDetail;
    // Idle bind uses __typeMap instead of a strict agentState match so
    // pending-idle confirmations (agentState: 'Engaged', pendingIdle: true)
    // are accepted without timing out.
    expect(detail.__typeMap).toBeDefined();
    expect(detail.__typeMap.typeField).toBe('agentState');
    // Immediate Idle confirmation: no extra conditions
    expect(detail.__typeMap.conditions.Idle).toEqual({});
    // Pending Idle while engaged: requires pendingIdle: true
    expect(detail.__typeMap.conditions.Engaged).toEqual({pendingIdle: true});
    expect(detail.__typeMap.conditions.WrapUp).toEqual({pendingIdle: true});
    expect(detail.__typeMap.conditions.Reserved).toEqual({pendingIdle: true});
    expect(detail.__typeMap.conditions.RONA).toEqual({pendingIdle: true});
    // Stale Available without pendingIdle rejected
    expect(detail.__typeMap.conditions.Available).toEqual({pendingIdle: true});
    // auxCodeId is a regular key (not inside __typeMap) so bindCheck verifies
    // the notification's idle code matches the request and bindPrint includes
    // it in the pending-request key.
    expect(detail.auxCodeId).toBe('aux-1');
  });

  it('stateChangeV2 Idle binds with different auxCodes cannot cross-resolve', () => {
    const lunchReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Idle', auxCodeId: 'lunch', channelType: ['chat']},
    });
    const wellnessReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Idle', auxCodeId: 'wellness', channelType: ['chat']},
    });
    const lunchDetail = lunchReq.notifSuccess.bind.data.agentChannelStateDetail;
    const wellnessDetail = wellnessReq.notifSuccess.bind.data.agentChannelStateDetail;
    // Each Idle bind carries its own auxCodeId
    expect(lunchDetail.auxCodeId).toBe('lunch');
    expect(wellnessDetail.auxCodeId).toBe('wellness');
    // Different auxCodeId → different bind keys → no cross-resolution
    expect(lunchDetail).not.toEqual(wellnessDetail);
  });

  it('stateChangeV2 Available and Idle binds produce different keys', () => {
    const availReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Available', auxCodeId: '0', channelType: ['chat']},
    });
    const idleReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Idle', auxCodeId: 'aux-1', channelType: ['chat']},
    });
    // Different agentChannelStateDetail shapes → different bind keys
    expect(availReq.notifSuccess.bind.data.agentChannelStateDetail).not.toEqual(
      idleReq.notifSuccess.bind.data.agentChannelStateDetail
    );
  });

  it('stateChangeV2 uses distinct bind keys per channel set', () => {
    const chatReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Available', auxCodeId: '0', channelType: ['chat']},
    });
    const emailReq = (agent.stateChangeV2 as unknown as (p: {data: object}) => any)({
      data: {state: 'Available', auxCodeId: '0', channelType: ['email']},
    });
    expect(chatReq.notifSuccess.bind.data.channelType).toEqual(['chat']);
    expect(emailReq.notifSuccess.bind.data.channelType).toEqual(['email']);
    expect(chatReq.notifSuccess.bind.data.channelType).not.toEqual(
      emailReq.notifSuccess.bind.data.channelType
    );
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

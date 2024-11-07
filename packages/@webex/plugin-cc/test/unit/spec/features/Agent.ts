import {LoginOption, WebexSDK} from '../../../../src/types';
import HttpRequest from '../../../../src/services/HttpRequest';
import AgentService from '../../../../src/services/AgentService';
import Agent from '../../../../src/features/Agent';
import {StationLoginSuccess} from '../../../../src/services/types';
import {AGENT, WEB_RTC_PREFIX} from '../../../../src/services/constants';
import {StationLoginResponse} from '../../../../src/features/types';

// Mock dependencies
jest.mock('../../../../src/services/AgentService');

describe('Agent', () => {
  let webexMock: WebexSDK;
  let httpRequestMock: HttpRequest;
  let agentServiceMock: AgentService;
  let agent: Agent;

  beforeEach(() => {
    webexMock = {
      logger: {
        log: jest.fn(),
      },
    } as unknown as WebexSDK;

    httpRequestMock = {} as HttpRequest;
    agentServiceMock = new AgentService(webexMock, httpRequestMock) as AgentService;

    (AgentService as jest.Mock).mockImplementation(() => agentServiceMock);

    agent = new Agent(webexMock, httpRequestMock);
  });

  describe('AgentService.getDeviceId', () => {
    it('should return dialNumber when loginOption is EXTENSION', () => {
      const loginOption = LoginOption.EXTENSION;
      const dialNumber = '12345';
      const result = agent['getDeviceId'](loginOption, dialNumber);
      expect(result).toBe(dialNumber);
    });

    it('should return dialNumber when loginOption is AGENT_DN', () => {
      const loginOption = LoginOption.AGENT_DN;
      const dialNumber = '12345';
      const result = agent['getDeviceId'](loginOption, dialNumber);
      expect(result).toBe(dialNumber);
    });

    it('should return WEB_RTC_PREFIX + dialNumber for other loginOptions', () => {
      const loginOption = 'OTHER_OPTION';
      const dialNumber = '12345';
      const result = agent['getDeviceId'](loginOption, dialNumber);
      expect(result).toBe(WEB_RTC_PREFIX + dialNumber);
    });
  });

  it('should successfully login when stationLogin is called with valid parameters', async () => {
    const loginResponse: StationLoginSuccess = {
      type: 'AgentStationLoginSuccess',
      eventType: 'AgentDesktopMessage',
      agentId: 'agentId123',
      trackingId: 'trackingId123',
      auxCodeId: 'auxCodeId123',
      teamId: 'teamId123',
      agentSessionId: 'agentSessionId123',
      orgId: 'orgId123',
      interactionIds: ['interactionId1', 'interactionId2'],
      status: 'loggedIn',
      subStatus: 'Available',
      siteId: 'siteId123',
      lastIdleCodeChangeTimestamp: Date.now(),
      lastStateChangeTimestamp: Date.now(),
      profileType: 'profileType123',
      channelsMap: {channel1: ['subChannel1']},
      dialNumber: '12345',
      roles: ['role1', 'role2'],
      supervisorSessionId: 'supervisorSessionId123',
    };
    agentServiceMock.stationLogin.mockResolvedValue(loginResponse);

    const response = await agent.stationLogin({
      teamId: 'team1',
      loginOption: LoginOption.AGENT_DN,
      dialNumber: '12345',
    });

    expect(agentServiceMock.stationLogin).toHaveBeenCalledWith({
      teamId: 'team1',
      deviceType: LoginOption.AGENT_DN,
      dialNumber: '12345',
      isExtension: false,
      deviceId: '12345',
      roles: [AGENT],
    });
    expect(webexMock.logger.log).toHaveBeenCalledWith('Station Login Success');
    expect(response).toEqual(loginResponse);
  });

  it('should handle failure when stationLogin is called', async () => {
    const error = new Error('Network Error');
    agentServiceMock.stationLogin.mockRejectedValue(error);

    await expect(
      agent.stationLogin({
        teamId: 'team1',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      })
    ).rejects.toThrow(error);

    expect(agentServiceMock.stationLogin).toHaveBeenCalledWith({
      teamId: 'team1',
      deviceType: LoginOption.EXTENSION,
      dialNumber: '1001',
      isExtension: true,
      deviceId: '1001',
      roles: [AGENT],
    });
    expect(webexMock.logger.log).not.toHaveBeenCalledWith('Station Login Success');
  });

  it('should login with loginOption is BROWSER', async () => {
    const loginResponse: StationLoginSuccess = {
      type: 'AgentStationLoginSuccess',
      eventType: 'AgentDesktopMessage',
      agentId: 'agentId123',
      trackingId: 'trackingId123',
      auxCodeId: 'auxCodeId123',
      teamId: 'teamId123',
      agentSessionId: 'agentSessionId123',
      orgId: 'orgId123',
      interactionIds: ['interactionId1', 'interactionId2'],
      status: 'loggedIn',
      subStatus: 'Available',
      siteId: 'siteId123',
      lastIdleCodeChangeTimestamp: Date.now(),
      lastStateChangeTimestamp: Date.now(),
      profileType: 'profileType123',
      channelsMap: {channel1: ['subChannel1']},
      dialNumber: '12345',
      roles: ['role1', 'role2'],
      supervisorSessionId: 'supervisorSessionId123',
    };
    agentServiceMock.stationLogin.mockResolvedValue(loginResponse);

    const response = await agent.stationLogin({
      teamId: 'team1',
      loginOption: LoginOption.BROWSER,
      dialNumber: 'agentId',
    });

    expect(agentServiceMock.stationLogin).toHaveBeenCalledWith({
      teamId: 'team1',
      deviceType: LoginOption.BROWSER,
      dialNumber: 'agentId',
      isExtension: false,
      deviceId: WEB_RTC_PREFIX + 'agentId',
      roles: [AGENT],
    });
    expect(webexMock.logger.log).toHaveBeenCalledWith('Station Login Success');
    expect(response).toEqual(loginResponse);
  });
});

import { STATION_LOGIN_TYPE, WebexSDK } from '../../../../src/types';
import HttpRequest from '../../../../src/services/HttpRequest';
import AgentService from '../../../../src/services/AgentService';
import Agent from '../../../../src/features/Agent';
import { StationLoginSuccess } from '../../../../src/services/types';

// Mock dependencies
jest.mock('../../../../src/services/AgentService');

describe('Agent', () => {
  let webexMock: WebexSDK;
  let httpRequestMock: HttpRequest;
  let agentServiceMock: jest.Mocked<AgentService>;
  let agent: Agent;

  beforeEach(() => {
    webexMock = {
      logger: {
        log: jest.fn(),
      },
    } as unknown as WebexSDK;

    httpRequestMock = {} as HttpRequest;
    agentServiceMock = new AgentService(webexMock, httpRequestMock) as jest.Mocked<AgentService>;

    (AgentService as jest.Mock).mockImplementation(() => agentServiceMock);

    agent = new Agent(webexMock, httpRequestMock);
  });

  it('should successfully login when stationLogin is called with valid parameters', async () => {
    const loginResponse = {} as StationLoginSuccess;
    agentServiceMock.stationLogin.mockResolvedValue(loginResponse);

    const response = await agent.stationLogin({
      teamId: 'team1',
      loginOption: STATION_LOGIN_TYPE.AGENT_DN,
      dialNumber: '12345',
    });

    expect(agentServiceMock.stationLogin).toHaveBeenCalledWith({
      teamId: 'team1',
      loginOption: STATION_LOGIN_TYPE.AGENT_DN,
      dialNumber: '12345',
    });
    expect(webexMock.logger.log).toHaveBeenCalledWith('LOGIN API SUCCESS');
    expect(response).toBe(loginResponse);
  });

  it('should handle failure when stationLogin is called', async () => {
    const error = new Error('Network Error');
    agentServiceMock.stationLogin.mockRejectedValue(error);

    await expect(
      agent.stationLogin({
        teamId: 'team1',
        loginOption: STATION_LOGIN_TYPE.EXTENSION,
        dialNumber: '1001',
      })
    ).rejects.toThrow('Error while performing agent login');

    expect(agentServiceMock.stationLogin).toHaveBeenCalledWith({
      teamId: 'team1',
      loginOption: STATION_LOGIN_TYPE.EXTENSION,
      dialNumber: '1001',
    });
    expect(webexMock.logger.log).not.toHaveBeenCalledWith('LOGIN API SUCCESS');
  });

  it('should login with loginOption is BROWSER', async () => {
    const loginResponse = {} as StationLoginSuccess;
    agentServiceMock.stationLogin.mockResolvedValue(loginResponse);

    const response = await agent.stationLogin({
      teamId: 'team1',
      loginOption: STATION_LOGIN_TYPE.BROWSER,
      dialNumber: 'agentId',
    });

    expect(agentServiceMock.stationLogin).toHaveBeenCalledWith({
      teamId: 'team1',
      loginOption: STATION_LOGIN_TYPE.BROWSER,
      dialNumber: 'agentId',
    });
    expect(webexMock.logger.log).toHaveBeenCalledWith('LOGIN API SUCCESS');
    expect(response).toBe(loginResponse);
  });
});
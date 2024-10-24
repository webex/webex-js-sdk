import AgentLogin from '../../../../src/AgentLogin/AgentLogin';
import { HTTP_METHODS, WebexSDK } from '../../../../src/types';

describe('AgentLogin', () => {
  let webexMock: WebexSDK;
  let agentLogin: AgentLogin;
  const wccAPIURL = 'https://api.example.com/';

  beforeEach(() => {
    webexMock = {
      request: jest.fn(),
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
    } as unknown as WebexSDK;

    agentLogin = new AgentLogin(webexMock, wccAPIURL);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should login agent with selected team successfully', async () => {
    const teamId = 'team123';
    const agentDeviceType = 'AGENT_DN';
    const deviceId = 'device123';
    const expectedResponse = { success: true };

    (webexMock.request as jest.Mock).mockResolvedValue(expectedResponse);

    const response = await agentLogin.loginAgentWithSelectedTeam(teamId, agentDeviceType, deviceId);

    expect(webexMock.request).toHaveBeenCalledWith({
      method: HTTP_METHODS.POST,
      uri: `${wccAPIURL}v1/agents/login`,
      body: {
        dialNumber: deviceId,
        teamId,
        isExtension: false,
        roles: ['agent'],
        deviceType: agentDeviceType,
        deviceId,
      },
    });
    expect(response).toEqual(expectedResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('LOGIN API INVOKED');
  });

  it('should handle error during agent login', async () => {
    const teamId = 'team123';
    const agentDeviceType = 'AGENT_DN';
    const deviceId = 'device123';
    const errorMessage = 'Test Error';

    (webexMock.request as jest.Mock).mockRejectedValue(new Error(errorMessage));

    await expect(agentLogin.loginAgentWithSelectedTeam(teamId, agentDeviceType, deviceId)).rejects.toThrow(
      `Error while performing agent login: ${errorMessage}`
    );
  });

  it('should login agent with extension device type', async () => {
    const teamId = 'team123';
    const agentDeviceType = 'EXTENSION';
    const deviceId = 'device123';
    const expectedResponse = { success: true };

    (webexMock.request as jest.Mock).mockResolvedValue(expectedResponse);

    const response = await agentLogin.loginAgentWithSelectedTeam(teamId, agentDeviceType, deviceId);

    expect(webexMock.request).toHaveBeenCalledWith({
      method: HTTP_METHODS.POST,
      uri: `${wccAPIURL}v1/agents/login`,
      body: {
        dialNumber: deviceId,
        teamId,
        isExtension: true,
        roles: ['agent'],
        deviceType: agentDeviceType,
        deviceId,
      },
    });
    expect(response).toEqual(expectedResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('LOGIN API INVOKED');
  });

  it('should login agent with browser device type', async () => {
    const teamId = 'team123';
    const agentDeviceType = 'BROWSER';
    const deviceId = 'webrtc-AgentUUID';
    const expectedResponse = { success: true };

    (webexMock.request as jest.Mock).mockResolvedValue(expectedResponse);

    const response = await agentLogin.loginAgentWithSelectedTeam(teamId, agentDeviceType, deviceId);

    expect(webexMock.request).toHaveBeenCalledWith({
      method: HTTP_METHODS.POST,
      uri: `${wccAPIURL}v1/agents/login`,
      body: {
        dialNumber: deviceId,
        teamId,
        isExtension: false,
        roles: ['agent'],
        deviceType: agentDeviceType,
        deviceId,
      },
    });
    expect(response).toEqual(expectedResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('LOGIN API INVOKED');
  });

  it('should handle missing teamId', async () => {
    const agentDeviceType = 'AGENT_DN';
    const deviceId = 'device123';

    await expect(agentLogin.loginAgentWithSelectedTeam('', agentDeviceType, deviceId)).rejects.toThrow(
      'Error while performing agent login: Missing teamId'
    );
  });

  it('should handle missing deviceId', async () => {
    const teamId = 'team123';
    const agentDeviceType = 'AGENT_DN';

    await expect(agentLogin.loginAgentWithSelectedTeam(teamId, agentDeviceType, '')).rejects.toThrow(
      'Error while performing agent login: Missing deviceId'
    );
  });
});
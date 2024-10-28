import { STATION_LOGIN_TYPE, WebexSDK } from '../../../../src/types';
import httpRequest from '../../../../src/services/httpRequest';
import AgentService from '../../../../src/services/AgentService';
import Agent from '../../../../src/features/Agent';

jest.mock('../../../../src/services/AgentService');

describe('Agent', () => {
  let webex: WebexSDK;
  let httpRequest: httpRequest;
  let agent: Agent;
  let agentServiceMock: jest.Mocked<AgentService>;

  beforeEach(() => {
    webex = {
      logger: {
        log: jest.fn(),
      },
      internal: {
        device: {
          orgId: 'orgId',
        },
      },
    } as unknown as WebexSDK;

    httpRequest = {} as httpRequest;
    agentServiceMock = new AgentService(webex, httpRequest) as jest.Mocked<AgentService>;
    agent = new Agent(webex, httpRequest);
    agent['agentService'] = agentServiceMock; // Replace the agentService with the mocked instance
  });

  describe('#stationLogin', () => {
    it('should successfully log in the agent', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: STATION_LOGIN_TYPE.AGENT_DN,
        dialNumber: '1234567890',
        agentId: 'agentId',
      };

      const loginResponse = { success: true };
      agentServiceMock.stationLogin.mockResolvedValue(loginResponse);

      const result = await agent.stationLogin(options);

      expect(result).toBe(loginResponse);
      expect(agentServiceMock.stationLogin).toHaveBeenCalledWith(options);
      expect(webex.logger.log).toHaveBeenCalledWith('LOGIN API SUCCESS');
    });

    it('should handle login error', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: STATION_LOGIN_TYPE.AGENT_DN,
        dialNumber: '1234567890',
        agentId: 'agentId',
      };

      const error = new Error('Login failed');
      agentServiceMock.stationLogin.mockRejectedValue(error);

      await expect(agent.stationLogin(options)).rejects.toThrow('Error while performing agent login');
      expect(agentServiceMock.stationLogin).toHaveBeenCalledWith(options);
    });
  });

  describe('#stationLogout', () => {
    it('should successfully log out the agent', async () => {
      const options = { logoutReason: 'End of shift' };

      const logoutResponse = { success: true };
      agentServiceMock.stationLogout.mockResolvedValue(logoutResponse);

      const result = await agent.stationLogout(options);

      expect(result).toBe(logoutResponse);
      expect(agentServiceMock.stationLogout).toHaveBeenCalledWith(options);
      expect(webex.logger.log).toHaveBeenCalledWith('Logout API SUCCESS');
    });

    it('should handle logout error', async () => {
      const options = { logoutReason: 'End of shift' };

      const error = new Error('Logout failed');
      agentServiceMock.stationLogout.mockRejectedValue(error);

      await expect(agent.stationLogout(options)).rejects.toThrow('Error while performing agent Logout');
      expect(agentServiceMock.stationLogout).toHaveBeenCalledWith(options);
    });
  });
});
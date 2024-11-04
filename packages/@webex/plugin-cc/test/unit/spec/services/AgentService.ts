import MockWebex from '@webex/test-helper-mock-webex';
import Mercury from '@webex/internal-plugin-mercury';
import AgentService from '../../../../src/services/AgentService';
import {
  WEB_RTC_PREFIX,
  AGENT,
  WCC_API_GATEWAY,
  LOGIN_API,
} from '../../../../src/services/constants';
import HttpRequest from '../../../../src/services/HttpRequest';
import {LoginOption, HTTP_METHODS} from '../../../../src/types';

jest.mock('../../../../src/services/HttpRequest');

describe('plugin-cc AgentService tests', () => {
  let webex;
  let agentService;
  let httpRequestMock;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        mercury: Mercury,
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
    });

    httpRequestMock = new HttpRequest({webex});
    httpRequestMock.sendRequestWithEvent = jest.fn();

    agentService = new AgentService(webex, httpRequestMock);
  });

  describe('AgentService.stationLogin', () => {
    it('should call sendRequestWithEvent with correct parameters', async () => {
      const expectedPayload = {
        dialNumber: '12345',
        teamId: 'team1',
        isExtension: true,
        roles: [AGENT],
        deviceType: LoginOption.EXTENSION,
        deviceId: '12345',
      };

      httpRequestMock.sendRequestWithEvent.mockResolvedValue('response_data');

      const result = await agentService.stationLogin(expectedPayload);

      expect(httpRequestMock.sendRequestWithEvent).toHaveBeenCalledWith({
        service: WCC_API_GATEWAY,
        resource: LOGIN_API,
        method: HTTP_METHODS.POST,
        payload: expectedPayload,
        eventType: 'StationLogin',
        success: ['AgentStationLoginSuccess'],
        failure: ['AgentStationLoginFailed'],
      });

      expect(result).toBe('response_data');
    });

    it('should log error and reject the promise on failure', async () => {
      const options = {
        teamId: 'team1',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '12345',
      };

      const error = new Error('Network Error');
      httpRequestMock.sendRequestWithEvent.mockRejectedValue(error);

      await expect(agentService.stationLogin(options)).rejects.toThrow('Network Error');
      expect(webex.logger.error).toHaveBeenCalledWith(`Error during station login: ${error}`);
    });
  });
});

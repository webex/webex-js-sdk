import 'jsdom-global/register';
import {LoginOption, WebexSDK} from '../../../src/types';
import HttpRequest from '../../../src/services/HttpRequest';
import Agent from '../../../src/features/Agent';
import WebRTCCalling from '../../../src/WebRTCCalling';
import ContactCenter from '../../../src/cc';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess} from '../../../src/services/types';

jest.mock('../../../src/services/AgentConfigService');
jest.mock('../../../src/services/HttpRequest');
jest.mock('../../../src/WebRTCCalling');

describe('webex.cc', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
      once: jest.fn((event, callback) => callback()),
    }) as unknown as WebexSDK;

    const httpRequest = new HttpRequest({webex});
    webex.cc.httpRequest = httpRequest;
    webex.cc.agent = new Agent(webex, httpRequest);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('stationLogin', () => {
    it('should login successfully with LoginOption.BROWSER', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
      };

      // Mock the method inside the instance that will be created
      const registerWebCallingLineMock = jest.fn().mockResolvedValue({});
      WebRTCCalling.prototype.registerWebCallingLine = registerWebCallingLineMock;

      const stationLoginMock = jest
        .spyOn(webex.cc.agent, 'stationLogin')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      expect(registerWebCallingLineMock).toHaveBeenCalled();
      expect(stationLoginMock).toHaveBeenCalledWith({
        ...options,
        dialNumber: 'agentId',
      });
      expect(result).toEqual({});
      expect(webex.logger.log).toHaveBeenCalledWith('LOGIN API SUCCESS');
    });

    it('should login successfully with other LoginOption', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.AGENT_DN,
        dialNumber: '1234567890',
      };

      const stationLoginMock = jest
        .spyOn(webex.cc.agent, 'stationLogin')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      expect(stationLoginMock).toHaveBeenCalledWith(options);
      expect(result).toEqual({});
      expect(webex.logger.log).toHaveBeenCalledWith('LOGIN API SUCCESS');
    });

    it('should handle error during stationLogin', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1234567890',
      };

      const error = new Error('Login failed');
      jest.spyOn(webex.cc.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(error);
    });

    it('should handle error during stationLogin with BROWSER login option', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
      };

      const error = new Error('Login failed');
      const registerWebCallingLineMock = jest.fn().mockRejectedValue(error);
      WebRTCCalling.prototype.registerWebCallingLine = registerWebCallingLineMock;
      jest.spyOn(webex.cc.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(error);
    });
  });

  describe('setAgentStatus', () => {
    it('should set agent status successfully when status is Available', async () => {

      const expectedPayload = {  
        state: 'Available',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Agent is available',
      };

      const setAgentStatusMock = jest
        .spyOn(webex.cc.agent, 'setAgentStatus')
        .mockResolvedValue(expectedPayload);

      const result = await webex.cc.setAgentStatus(expectedPayload);

      expect(setAgentStatusMock).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual(expectedPayload);
      expect(webex.logger.log).toHaveBeenCalledWith('file: cc: SET AGENT STATUS API SUCCESS');
    });

    it('should handle error during setAgentStatus when status is Available', async () => {

      const expectedPayload = {  
        state: 'Available',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Agent is available',
      };

      const error = new Error('Set status failed');
      jest.spyOn(webex.cc.agent, 'setAgentStatus').mockRejectedValue(error);

      await expect(webex.cc.setAgentStatus(expectedPayload)).rejects.toThrow(error);
      expect(webex.logger.error).toHaveBeenCalledWith('SET AGENT STATUS FAILED', error);
    });

    it('should set agent status successfully when status is Meeting', async () => {

      const expectedPayload = {  
        state: 'Meeting',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Agent is in meeting',
      };

      const setAgentStatusMock = jest
        .spyOn(webex.cc.agent, 'setAgentStatus')
        .mockResolvedValue(expectedPayload);

      const result = await webex.cc.setAgentStatus(expectedPayload);

      expect(setAgentStatusMock).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual(expectedPayload);
      expect(webex.logger.log).toHaveBeenCalledWith('file: cc: SET AGENT STATUS API SUCCESS');
    });

    it('should handle error during setAgentStatus when status is Meeting', async () => {
    
      const expectedPayload = {  
        state: 'Meeting',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Agent is in meeting',
      };

      const error = new Error('Set status failed');
      jest.spyOn(webex.cc.agent, 'setAgentStatus').mockRejectedValue(error);

      await expect(webex.cc.setAgentStatus(expectedPayload)).rejects.toThrow(error);
      expect(webex.logger.error).toHaveBeenCalledWith('SET AGENT STATUS FAILED', error);
    });

    it('should handle invalid status', async () => {

      const invalidPayload = {  
        state: 'invalid',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'invalid',
      };
      const error = new Error('Invalid status');
      jest.spyOn(webex.cc.agent, 'setAgentStatus').mockRejectedValue(error);

      await expect(webex.cc.setAgentStatus(invalidPayload)).rejects.toThrow(error);
      expect(webex.logger.error).toHaveBeenCalledWith('SET AGENT STATUS FAILED', error);
    });
  });
});
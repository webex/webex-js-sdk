import { WebexSDK } from '../../../../src/types';
import HttpRequest from '../../../../src/HttpRequest';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';

jest.mock('../../../../src/HttpRequest', () => {
  return jest.fn().mockImplementation(() => {
    return {
      request: jest.fn(),
    };
  });
});

describe('AgentConfigService', () => {
  let agentConfigService: AgentConfigService;
  let mockHttpRequest: jest.Mocked<HttpRequest>;
  const mockWebexSDK: WebexSDK = {
    logger: {
      log: jest.fn(),
    },
  } as unknown as WebexSDK;
  const mockWccAPIURL = 'https://api.example.com/';
  const mockAgentId = 'agent123';
  const mockOrgId = 'org123';

  beforeEach(() => {
    mockHttpRequest = new HttpRequest(mockWebexSDK) as jest.Mocked<HttpRequest>;
    agentConfigService = new AgentConfigService(mockAgentId, mockOrgId, mockWebexSDK, mockWccAPIURL);
    agentConfigService.requestInstance = mockHttpRequest;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserUsingCI', () => {
    it('should return AgentResponse on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          firstName: 'John',
          lastName: 'Doe',
          agentProfileId: 'profile123',
          email: 'john.doe@example.com',
          teamIds: ['team1', 'team2'],
        },
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getUserUsingCI();

      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getUserUsingCI api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      mockHttpRequest.request.mockRejectedValue(mockError);

      await expect(agentConfigService.getUserUsingCI()).rejects.toThrow('getUserUsingCI api failed. Error: Error: API call failed');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      await expect(agentConfigService.getUserUsingCI()).rejects.toThrow('getUserUsingCI api failed. Error: [object Object]');
    });
  });

  describe('getDesktopProfileById', () => {
    const desktopProfileId = 'profile123';

    it('should return DesktopProfileResponse on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          loginVoiceOptions: ['option1', 'option2'],
          accessWrapUpCode: 'ALL',
          accessIdleCode: 'SPECIFIC',
          wrapUpCodes: ['code1', 'code2'],
          idleCodes: ['idle1', 'idle2'],
        },
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getDesktopProfileById(desktopProfileId);

      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getDesktopProfileById api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      mockHttpRequest.request.mockRejectedValue(mockError);

      await expect(agentConfigService.getDesktopProfileById(desktopProfileId)).rejects.toThrow('getDesktopProfileById api failed. Error: Error: API call failed');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      await expect(agentConfigService.getDesktopProfileById(desktopProfileId)).rejects.toThrow('getDesktopProfileById api failed. Error: [object Object]');
    });
  });

  describe('getListOfTeams', () => {
    const page = 0;
    const pageSize = 10;
    const filter: string[] = [];
    const attributes: string[] = ['id'];

    it('should return ListTeamsResponse on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: [
          { id: 'team1', name: 'Team 1' },
          { id: 'team2', name: 'Team 2' },
        ],
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);

      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getListOfTeams api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      mockHttpRequest.request.mockRejectedValue(mockError);

      await expect(agentConfigService.getListOfTeams(page, pageSize, filter, attributes)).rejects.toThrow('getListOfTeams api failed. Error: Error: API call failed');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      await expect(agentConfigService.getListOfTeams(page, pageSize, filter, attributes)).rejects.toThrow('getListOfTeams api failed. Error: [object Object]');
    });
  });

  describe('getListOfAuxCodes', () => {
    const page = 0;
    const pageSize = 10;
    const filter: string[] = [];
    const attributes: string[] = ['id'];

    it('should return ListAuxCodesResponse on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          data: [
            { id: 'aux1', active: true, defaultCode: false, isSystemCode: false, description: 'Aux 1', name: 'Aux 1', workTypeCode: 'work1' },
            { id: 'aux2', active: true, defaultCode: false, isSystemCode: false, description: 'Aux 2', name: 'Aux 2', workTypeCode: 'work2' },
          ],
        },
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);

      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getListOfAuxCodes api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      mockHttpRequest.request.mockRejectedValue(mockError);

      await expect(agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes)).rejects.toThrow('getListOfAuxCodes api failed. Error: Error: API call failed');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      await expect(agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes)).rejects.toThrow('getListOfAuxCodes api failed. Error: [object Object]');
    });
  });
});
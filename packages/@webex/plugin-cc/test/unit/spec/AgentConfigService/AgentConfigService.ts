import { WebexSDK } from '../../../../src/types';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';

describe('AgentConfigService', () => {
  let agentConfigService: AgentConfigService;
  let mockWebexSDK: WebexSDK;
  const mockWccAPIURL = 'https://api.example.com/';
  const mockAgentId = 'agent123';
  const mockOrgId = 'org123';

  beforeEach(() => {
    mockWebexSDK = {
      request: jest.fn(),
      logger: {
        log: jest.fn(),
      },
    } as unknown as WebexSDK;
    agentConfigService = new AgentConfigService(mockAgentId, mockOrgId, mockWebexSDK, mockWccAPIURL);
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
          teamIds: ['123', '456'],
        },
      };
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getUserUsingCI();

      expect(mockWebexSDK.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: `${mockWccAPIURL}organization/${mockOrgId}/user/by-ci-user-id/${mockAgentId}`,
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getUserUsingCI api success.');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(agentConfigService.getUserUsingCI()).rejects.toThrow(`API call failed with ${mockResponse.statusCode}`)
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexSDK.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getUserUsingCI()).rejects.toThrow(
        'API call failed'
      );
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
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getDesktopProfileById(desktopProfileId);

      expect(mockWebexSDK.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: `${mockWccAPIURL}organization/${mockOrgId}/agent-profile/${desktopProfileId}`,
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getDesktopProfileById api success.');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(agentConfigService.getDesktopProfileById(desktopProfileId)).rejects.toThrow(`API call failed with ${mockResponse.statusCode}`)
    });


    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexSDK.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getDesktopProfileById(desktopProfileId)).rejects.toThrow(
        'API call failed'
      );
    });
  });

  describe('getListOfTeams', () => {
    const page = 0;
    const pageSize = 10;
    const filter: string[] = ['123'];
    const attributes: string[] = ['id'];

    it('should return team on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: [
          { id: '123', name: 'Team 1' },
          { id: '12345', name: 'Team 2' },
        ],
      };
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);

      expect(mockWebexSDK.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: `${mockWccAPIURL}organization/${mockOrgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getListOfTeams api success.');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(agentConfigService.getListOfTeams(page, pageSize, filter, attributes)).rejects.toThrow(`API call failed with ${mockResponse.statusCode}`)
    });


    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexSDK.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getListOfTeams(page, pageSize, filter, attributes)).rejects.toThrow(
        'API call failed'
      );
    });
  });

  describe('getListOfAuxCodes', () => {
    const page = 0;
    const pageSize = 10;
    const filter: string[] = ['123'];
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
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);

      expect(mockWebexSDK.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: `${mockWccAPIURL}organization/${mockOrgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getListOfAuxCodes api success.');
    });

    it('should throw an error if the status code is not 200', async () => {
      const mockResponse = {
        statusCode: 500,
        body: {},
      };
      (mockWebexSDK.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes)).rejects.toThrow(`API call failed with ${mockResponse.statusCode}`)
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexSDK.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes)).rejects.toThrow(
        'API call failed'
      );
    });
  });
});
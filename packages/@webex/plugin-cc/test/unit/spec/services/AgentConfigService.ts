import { WebexSDK } from '../../../../src/types';
import AgentConfigService from '../../../../src/services/AgentConfigService';
import HttpRequest from '../../../../src/services/HttpRequest';
import { WCC_API_GATEWAY } from '../../../../src/services/constants';

describe('AgentConfigService', () => {
  let agentConfigService: AgentConfigService;
  let mockWebexSDK: WebexSDK;
  let mockHttpRequest: HttpRequest;
  const mockAgentId = 'agent123';
  const mockOrgId = 'org123';
  const mockWccAPIURL = WCC_API_GATEWAY;

  beforeEach(() => {
    mockWebexSDK = {
      request: jest.fn(),
      logger: {
        log: jest.fn(),
      },
      internal: {
        device: {
          orgId: mockOrgId,
        },
      },
    } as unknown as WebexSDK;

    mockHttpRequest = {
      request: jest.fn(),
    } as unknown as HttpRequest;

    agentConfigService = new AgentConfigService(mockAgentId, mockWebexSDK, mockHttpRequest);
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
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getUserUsingCI();

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/user/by-ci-user-id/${mockAgentId}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getUserUsingCI api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getUserUsingCI()).rejects.toThrow('API call failed');
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
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getDesktopProfileById(desktopProfileId);

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/agent-profile/${desktopProfileId}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getDesktopProfileById api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getDesktopProfileById(desktopProfileId)).rejects.toThrow('API call failed');
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
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getListOfTeams api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getListOfTeams(page, pageSize, filter, attributes)).rejects.toThrow('API call failed');
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
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(mockWebexSDK.logger.log).toHaveBeenCalledWith('getListOfAuxCodes api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes)).rejects.toThrow('API call failed');
    });
  });
});
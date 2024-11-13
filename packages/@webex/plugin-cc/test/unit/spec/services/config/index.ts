import {WebexSDK} from '../../../../../src/types';
import AgentConfigService from '../../../../../src/services/config';
import HttpRequest from '../../../../../src/services/core/HttpRequest';
import {WCC_API_GATEWAY} from '../../../../../src/services/constants';
import MockWebex from '@webex/test-helper-mock-webex';

describe('AgentConfigService', () => {
  let agentConfigService: AgentConfigService;
  let webex: WebexSDK;
  let mockHttpRequest: HttpRequest;
  const mockAgentId = 'agent123';
  const mockOrgId = 'org123';
  const mockWccAPIURL = WCC_API_GATEWAY;

  beforeEach(() => {
    webex = new MockWebex({
      logger: {
        log: jest.fn(),
      },
    });

    webex.internal.device.orgId = mockOrgId;

    mockHttpRequest = HttpRequest.getInstance({webex});
    mockHttpRequest.request = jest.fn();

    agentConfigService = new AgentConfigService(mockAgentId, webex, mockHttpRequest);
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
      expect(webex.logger.log).toHaveBeenCalledWith('getUserUsingCI api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getUserUsingCI()).rejects.toThrow('API call failed');
    });

    it('should throw an error if the getUserUsingCI call fails with other than 200', async () => {
      const mockResponse = {
        statusCode: 400,
      };
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getUserUsingCI();
      } catch (error) {
        expect(error).toEqual(new Error(`API call failed with ${mockResponse.statusCode}`));
      }
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
      expect(webex.logger.log).toHaveBeenCalledWith('getDesktopProfileById api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      try {
        await agentConfigService.getDesktopProfileById(desktopProfileId);
      } catch (error) {
        expect(error).toEqual(mockError);
      }
    });

    it('should throw an error if the getDesktopProfileById call fails with other than 200', async () => {
      const mockResponse = {
        statusCode: 400,
      };
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getDesktopProfileById(desktopProfileId);
      } catch (error) {
        expect(error).toEqual(new Error(`API call failed with ${mockResponse.statusCode}`));
      }
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
          {id: '123', name: 'Team 1'},
          {id: '12345', name: 'Team 2'},
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
      expect(webex.logger.log).toHaveBeenCalledWith('getListOfTeams api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      try {
        await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);
      } catch (error) {
        expect(error).toEqual(mockError);
      }
    });

    it('should throw an error if the getListOfTeams call fails with other than 200', async () => {
      const mockResponse = {
        statusCode: 400,
      };
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);
      } catch (error) {
        expect(error).toEqual(new Error(`API call failed with ${mockResponse.statusCode}`));
      }
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
            {
              id: 'aux1',
              active: true,
              defaultCode: false,
              isSystemCode: false,
              description: 'Aux 1',
              name: 'Aux 1',
              workTypeCode: 'work1',
            },
            {
              id: 'aux2',
              active: true,
              defaultCode: false,
              isSystemCode: false,
              description: 'Aux 2',
              name: 'Aux 2',
              workTypeCode: 'work2',
            },
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
      expect(webex.logger.log).toHaveBeenCalledWith('getListOfAuxCodes api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);
      try {
        await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);
      } catch (error) {
        expect(error).toEqual(mockError);
      }
    });

    it('should throw an error if the getListOfAuxCodes call fails with other than 200', async () => {
      const mockResponse = {
        statusCode: 400,
      };
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);
      } catch (error) {
        expect(error).toEqual(new Error(`API call failed with ${mockResponse.statusCode}`));
      }
    });
  });
});

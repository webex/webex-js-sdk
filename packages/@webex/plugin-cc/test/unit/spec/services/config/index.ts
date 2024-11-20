import {WebexSDK} from '../../../../../src/types';
import AgentConfigService from '../../../../../src/services/config';
import HttpRequest from '../../../../../src/services/core/HttpRequest';
import {WCC_API_GATEWAY} from '../../../../../src/services/constants';
import MockWebex from '@webex/test-helper-mock-webex';
import LoggerProxy from '../../../../../src/logger-proxy';
import * as util from '../../../../../src/services/config/Util';

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
        error: jest.fn(),
        info: jest.fn(),
      },
    });

    LoggerProxy.logger = webex.logger;
    mockHttpRequest = HttpRequest.getInstance({webex});
    mockHttpRequest.request = jest.fn();

    agentConfigService = new AgentConfigService();
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

      const result = await agentConfigService.getUserUsingCI(mockOrgId, mockAgentId);

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/user/by-ci-user-id/${mockAgentId}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getUserUsingCI api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getUserUsingCI(mockOrgId, mockAgentId)).rejects.toThrow(
        'API call failed'
      );
    });

    it('should throw an error if the getUserUsingCI call fails with other than 200', async () => {
      const mockResponse = {
        statusCode: 400,
      };
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getUserUsingCI(mockOrgId, mockAgentId);
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

      const result = await agentConfigService.getDesktopProfileById(mockOrgId, desktopProfileId);

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/agent-profile/${desktopProfileId}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getDesktopProfileById api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      try {
        await agentConfigService.getDesktopProfileById(mockOrgId, desktopProfileId);
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
        await agentConfigService.getDesktopProfileById(mockOrgId, desktopProfileId);
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

      const result = await agentConfigService.getListOfTeams(
        mockOrgId,
        page,
        pageSize,
        filter,
        attributes
      );

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getListOfTeams api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);

      try {
        await agentConfigService.getListOfTeams(mockOrgId, page, pageSize, filter, attributes);
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
        await agentConfigService.getListOfTeams(mockOrgId, page, pageSize, filter, attributes);
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

      const result = await agentConfigService.getListOfAuxCodes(
        mockOrgId,
        page,
        pageSize,
        filter,
        attributes
      );

      expect(mockHttpRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getListOfAuxCodes api success.');
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockHttpRequest.request as jest.Mock).mockRejectedValue(mockError);
      try {
        await agentConfigService.getListOfAuxCodes(mockOrgId, page, pageSize, filter, attributes);
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
        await agentConfigService.getListOfAuxCodes(mockOrgId, page, pageSize, filter, attributes);
      } catch (error) {
        expect(error).toEqual(new Error(`API call failed with ${mockResponse.statusCode}`));
      }
    });
  });

  describe('getOrgInfo', () => {
    it('should return organization info successfully', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          id: 'org123',
          name: 'Organization 123',
          description: 'Description',
          type: 'type',
          status: 'status',
          created: '2021-01-01',
        },
      };
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOrgInfo(mockOrgId);
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getOrgInfo api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const mockError = {statusCode: 500};
      mockHttpRequest.request.mockResolvedValue(mockError);

      await expect(agentConfigService.getOrgInfo(mockOrgId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getOrgInfo API call failed with')
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockHttpRequest.request.mockRejectedValue(networkError);

      await expect(agentConfigService.getOrgInfo(mockOrgId)).rejects.toThrow('Network Error');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getOrgInfo API call failed with')
      );
    });

    it('should handle timeout errors gracefully', async () => {
      const timeoutError = new Error('Timeout Error');
      mockHttpRequest.request.mockRejectedValue(timeoutError);

      await expect(agentConfigService.getOrgInfo(mockOrgId)).rejects.toThrow('Timeout Error');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getOrgInfo API call failed with')
      );
    });
  });

  describe('getOrganizationSetting', () => {
    it('should return organization settings successfully', async () => {
      const mockResponse = {statusCode: 200, body: {data: [{}]}}; // Adjust data accordingly
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOrganizationSetting();
      expect(result).toEqual(mockResponse.body.data[0]);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getOrganizationSetting api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const mockError = {statusCode: 500};
      mockHttpRequest.request.mockResolvedValue(mockError);

      await expect(agentConfigService.getOrganizationSetting(mockOrgId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getOrganizationSetting API call failed with')
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockHttpRequest.request.mockRejectedValue(networkError);

      await expect(agentConfigService.getOrganizationSetting(mockOrgId)).rejects.toThrow(
        'Network Error'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getOrganizationSetting API call failed with')
      );
    });

    it('should handle timeout errors gracefully', async () => {
      const timeoutError = new Error('Timeout Error');
      mockHttpRequest.request.mockRejectedValue(timeoutError);

      await expect(agentConfigService.getOrganizationSetting(mockOrgId)).rejects.toThrow(
        'Timeout Error'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getOrganizationSetting API call failed with')
      );
    });
  });

  describe('getTenantData', () => {
    it('should return tenant successfully', async () => {
      const mockResponse = {statusCode: 200, body: {data: [{}]}}; // Adjust data accordingly
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getTenantData(mockOrgId);
      expect(result).toEqual(mockResponse.body.data[0]);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getTenantData api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const mockError = {statusCode: 500};
      mockHttpRequest.request.mockResolvedValue(mockError);

      await expect(agentConfigService.getTenantData(mockOrgId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getTenantData API call failed with')
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockHttpRequest.request.mockRejectedValue(networkError);

      await expect(agentConfigService.getTenantData(mockOrgId)).rejects.toThrow('Network Error');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getTenantData API call failed with')
      );
    });
  });

  describe(`getURLMapping`, () => {
    it('should return URL mapping successfully', async () => {
      const mockResponse = {statusCode: 200, body: {data: {}}}; // Adjust data accordingly
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getURLMapping(mockOrgId);
      expect(result).toEqual(mockResponse.body.data);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getURLMapping api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const mockError = {statusCode: 500};
      mockHttpRequest.request.mockResolvedValue(mockError);

      await expect(agentConfigService.getURLMapping(mockOrgId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getURLMapping API call failed with')
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockHttpRequest.request.mockRejectedValue(networkError);

      await expect(agentConfigService.getURLMapping(mockOrgId)).rejects.toThrow('Network Error');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getURLMapping API call failed with')
      );
    });
  });

  describe(`getDialPlanData`, () => {
    it('should return dial plan data successfully', async () => {
      const mockResponse = {statusCode: 200, body: {data: {}}}; // Adjust data accordingly
      mockHttpRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getDialPlanData(mockOrgId);
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.logger.log).toHaveBeenCalledWith('getDialPlanData api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const mockError = {statusCode: 500};
      mockHttpRequest.request.mockResolvedValue(mockError);

      await expect(agentConfigService.getDialPlanData(mockOrgId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getDialPlanData API call failed with')
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockHttpRequest.request.mockRejectedValue(networkError);

      await expect(agentConfigService.getDialPlanData(mockOrgId)).rejects.toThrow('Network Error');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getDialPlanData API call failed with')
      );
    });
  });

  describe(`getAllTeams`, () => {
    it('should return all teams successfully', async () => {
      const pageSize = 10;
      const filter = ['filter1'];
      const attributes = ['attribute1'];

      const mockResponseFirst = {
        body: {
          data: [{id: 'team1'}],
          meta: {totalPages: 3},
        },
        statusCode: 200,
      };
      const mockResponseOther = {
        body: {
          data: [{id: 'team2'}],
        },
        statusCode: 200,
      };
      (mockHttpRequest.request as jest.Mock)
        .mockResolvedValueOnce(mockResponseFirst)
        .mockResolvedValue(mockResponseOther);

      const result = await agentConfigService.getAllTeams(mockOrgId, pageSize, filter, attributes);
      expect(result).toEqual([
        ...mockResponseFirst.body.data,
        ...mockResponseOther.body.data,
        ...mockResponseOther.body.data,
      ]);

      expect(LoggerProxy.logger.log).toHaveBeenCalledTimes(3);

      // Verify that each call was made with the expected message
      expect(LoggerProxy.logger.log).toHaveBeenNthCalledWith(1, 'getListOfTeams api success.');
      expect(LoggerProxy.logger.log).toHaveBeenNthCalledWith(2, 'getListOfTeams api success.');
      expect(LoggerProxy.logger.log).toHaveBeenNthCalledWith(3, 'getListOfTeams api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const pageSize = 10;
      const filter = ['filter1'];
      const attributes = ['attribute1'];

      const mockError = {statusCode: 500};
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockError);

      await expect(
        agentConfigService.getAllTeams(mockOrgId, pageSize, filter, attributes)
      ).rejects.toThrow('API call failed with 500');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getListOfTeams API call failed with')
      );
    });
  });

  describe(`getAllAuxCodes`, () => {
    it('should return all aux codes successfully', async () => {
      const pageSize = 10;
      const filter = ['filter1'];
      const attributes = ['attribute1'];

      const mockResponseFirst = {
        body: {
          data: [{id: 'aux1'}],
          meta: {totalPages: 3},
        },
        statusCode: 200,
      };
      const mockResponseOther = {
        body: {
          data: [{id: 'aux2'}],
        },
        statusCode: 200,
      };
      (mockHttpRequest.request as jest.Mock)
        .mockResolvedValueOnce(mockResponseFirst)
        .mockResolvedValue(mockResponseOther);

      const result = await agentConfigService.getAllAuxCodes(
        mockOrgId,
        pageSize,
        filter,
        attributes
      );
      expect(result).toEqual([
        ...mockResponseFirst.body.data,
        ...mockResponseOther.body.data,
        ...mockResponseOther.body.data,
      ]);

      expect(LoggerProxy.logger.log).toHaveBeenCalledTimes(3);

      // Verify that each call was made with the expected message
      expect(LoggerProxy.logger.log).toHaveBeenNthCalledWith(1, 'getListOfAuxCodes api success.');
      expect(LoggerProxy.logger.log).toHaveBeenNthCalledWith(2, 'getListOfAuxCodes api success.');
      expect(LoggerProxy.logger.log).toHaveBeenNthCalledWith(3, 'getListOfAuxCodes api success.');
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const pageSize = 10;
      const filter = ['filter1'];
      const attributes = ['attribute1'];

      const mockError = {statusCode: 500};
      (mockHttpRequest.request as jest.Mock).mockResolvedValue(mockError);

      await expect(
        agentConfigService.getAllAuxCodes(mockOrgId, pageSize, filter, attributes)
      ).rejects.toThrow('API call failed with 500');
      expect(LoggerProxy.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('getListOfAuxCodes API call failed with')
      );
    });
  });

  describe('getAgentConfig', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should fetch and parse agent configuration successfully', async () => {
      const mockAgentId = 'agent001';
      const mockUserConfig = {
        ciUserId: 'agent001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        agentProfileId: 'profile123',
        siteId: 'site789',
        dbId: 'db123',
        defaultDialledNumber: '1234567890',
        id: 'user001',
        teamIds: ['team1', 'team2'],
      };

      const mockAgentProfile = {
        timeoutDesktopInactivityCustomEnabled: true,
        timeoutDesktopInactivityMins: 10,
        accessWrapUpCode: 'SPECIFIC',
        wrapUpCodes: ['aux1'],
        accessIdleCode: 'SPECIFIC',
        idleCodes: ['aux2'],
        autoWrapUp: true,
        autoWrapAfterSeconds: 30,
        lastAgentRouting: true,
        allowAutoWrapUpExtension: false,
        outdialEnabled: true,
        dialPlanEnabled: false,
        agentAvailableAfterOutdial: true,
        outdialEntryPointId: 'entryPoint123',
        consultToQueue: true,
        addressBookId: 'addressBook123',
        outdialANIId: 'ani123',
        dialPlans: ['plan1', 'plan2'],
        agentDNValidation: 'validation123',
      };

      const mockDialPlanData = [];

      const mockTeamData = [
        {id: 'team1', name: 'Support Team'},
        {id: 'team2', name: 'Sales Team'},
      ];

      const mockOrgInfo = {
        tenantId: 'tenant123',
        timezone: 'GMT',
      };

      const mockOrgSettings = {
        campaignManagerEnabled: true,
        webRtcEnabled: true,
        maskSensitiveData: false,
      };

      const mockTenantData = {
        timeoutDesktopInactivityEnabled: false,
        timeoutDesktopInactivityMins: 15,
        forceDefaultDn: true,
        dnDefaultRegex: 'regexUS',
        dnOtherRegex: 'regexOther',
        privacyShieldVisible: true,
        outdialEnabled: true,
        endCallEnabled: true,
        endConsultEnabled: true,
        callVariablesSuppressed: false,
      };

      const mockURLMapping = [
        {key: 'ACQUEON_API_URL', url: 'https://api.example.com'},
        {key: 'ACQUEON_CONSOLE_URL', url: 'https://console.example.com'},
      ];

      const mockAuxCodes = [
        {id: 'aux1', type: 'WRAP_UP_CODE', name: 'Wrap Up Code 1', isDefault: true},
        {id: 'aux2', type: 'IDLE_CODE', name: 'Idle Code 1', isDefault: true},
      ];

      const parseAgentConfigsSpy = jest.spyOn(util, 'parseAgentConfigs');
      agentConfigService.getUserUsingCI = jest.fn().mockResolvedValue(mockUserConfig);
      agentConfigService.getOrgInfo = jest.fn().mockResolvedValue(mockOrgInfo);
      agentConfigService.getOrganizationSetting = jest.fn().mockResolvedValue(mockOrgSettings);
      agentConfigService.getTenantData = jest.fn().mockResolvedValue(mockTenantData);
      agentConfigService.getURLMapping = jest.fn().mockResolvedValue(mockURLMapping);
      agentConfigService.getAllAuxCodes = jest.fn().mockResolvedValue(mockAuxCodes);
      agentConfigService.getDesktopProfileById = jest.fn().mockResolvedValue(mockAgentProfile);
      agentConfigService.getDialPlanData = jest.fn().mockResolvedValue(mockDialPlanData);
      agentConfigService.getAllTeams = jest.fn().mockResolvedValue(mockTeamData);

      const result = await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Fetched user data');
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Fetched all required data');
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Parsing completed for agent-config');
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith(
        'Fetched configuration data successfully'
      );
      expect(parseAgentConfigsSpy).toHaveBeenCalledTimes(1);

      expect(parseAgentConfigsSpy).toHaveBeenCalledWith({
        userData: mockUserConfig,
        teamData: mockTeamData,
        tenantData: mockTenantData,
        orgInfoData: mockOrgInfo,
        auxCodes: mockAuxCodes,
        orgSettingsData: mockOrgSettings,
        agentProfileData: mockAgentProfile,
        dialPlanData: mockDialPlanData,
        urlMapping: mockURLMapping,
      });
    });

    it('should fetch and parse agent configuration with different values and conditions successfully', async () => {
      const mockAgentId = 'agent001';
      const mockUserConfig = {
        ciUserId: 'agent001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        agentProfileId: 'profile123',
        skillProfileId: 'skillProfile456',
        siteId: 'site789',
        dbId: 'db123',
        defaultDialledNumber: '1234567890',
        id: 'user001',
        teamIds: ['team1', 'team2'],
      };

      const mockAgentProfile = {
        timeoutDesktopInactivityCustomEnabled: false,
        timeoutDesktopInactivityMins: 10,
        accessWrapUpCode: 'ALL',
        wrapUpCodes: [],
        accessIdleCode: 'ALL',
        idleCodes: [],
        autoWrapUp: true,
        autoWrapAfterSeconds: 30,
        lastAgentRouting: true,
        allowAutoWrapUpExtension: false,
        outdialEnabled: true,
        dialPlanEnabled: true,
        agentAvailableAfterOutdial: true,
        outdialEntryPointId: 'entryPoint123',
        consultToQueue: true,
        viewableStatistics: {agentStats: true},
        addressBookId: 'addressBook123',
        outdialANIId: 'ani123',
        loginVoiceOptions: ['option1', 'option2'],
        dialPlans: ['dialPlan1', 'dialPlan2'],
        agentDNValidation: 'validation123',
      };

      const mockDialPlanData = [
        {id: 'dialPlan1', name: 'Plan 1'},
        {id: 'dialPlan2', name: 'Plan 2'},
      ];

      const mockTeamData = [
        {id: 'team1', name: 'Support Team'},
        {id: 'team2', name: 'Sales Team'},
      ];

      const mockOrgInfo = {
        tenantId: 'tenant123',
        timezone: 'GMT',
      };

      const mockOrgSettings = {
        campaignManagerEnabled: true,
        webRtcEnabled: true,
        maskSensitiveData: true,
      };

      const mockTenantData = {
        timeoutDesktopInactivityEnabled: true,
        timeoutDesktopInactivityMins: 15,
        forceDefaultDn: true,
        dnDefaultRegex: 'regexUS',
        dnOtherRegex: 'regexOther',
        privacyShieldVisible: true,
        outdialEnabled: true,
        endCallEnabled: true,
        endConsultEnabled: true,
        callVariablesSuppressed: false,
        lostConnectionRecoveryTimeout: 30,
      };

      const mockURLMapping = [
        {key: 'ACQUEON_API_URL', url: 'https://api.example.com'},
        {key: 'ACQUEON_CONSOLE_URL', url: 'https://console.example.com'},
      ];

      const mockAuxCodes = [
        {id: 'aux1', type: 'WRAP_UP_CODE', name: 'Wrap Up Code 1'},
        {id: 'aux2', type: 'IDLE_CODE', name: 'Idle Code 1'},
      ];

      const parseAgentConfigsSpy = jest.spyOn(util, 'parseAgentConfigs');
      agentConfigService.getUserUsingCI = jest.fn().mockResolvedValue(mockUserConfig);
      agentConfigService.getOrgInfo = jest.fn().mockResolvedValue(mockOrgInfo);
      agentConfigService.getOrganizationSetting = jest.fn().mockResolvedValue(mockOrgSettings);
      agentConfigService.getTenantData = jest.fn().mockResolvedValue(mockTenantData);
      agentConfigService.getURLMapping = jest.fn().mockResolvedValue(mockURLMapping);
      agentConfigService.getAllAuxCodes = jest.fn().mockResolvedValue(mockAuxCodes);
      agentConfigService.getDesktopProfileById = jest.fn().mockResolvedValue(mockAgentProfile);
      agentConfigService.getDialPlanData = jest.fn().mockResolvedValue(mockDialPlanData);
      agentConfigService.getAllTeams = jest.fn().mockResolvedValue(mockTeamData);

      const result = await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Fetched user data');
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Fetched all required data');
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Parsing completed for agent-config');
      expect(LoggerProxy.logger.info).toHaveBeenCalledWith(
        'Fetched configuration data successfully'
      );
      expect(parseAgentConfigsSpy).toHaveBeenCalledTimes(1);

      expect(parseAgentConfigsSpy).toHaveBeenCalledWith({
        userData: mockUserConfig,
        teamData: mockTeamData,
        tenantData: mockTenantData,
        orgInfoData: mockOrgInfo,
        auxCodes: mockAuxCodes,
        orgSettingsData: mockOrgSettings,
        agentProfileData: mockAgentProfile,
        dialPlanData: mockDialPlanData,
        urlMapping: mockURLMapping,
      });
    });

    it('should throw an error if any of the API calls fail', async () => {
      const mockAgentId = 'agent001';
      const mockError = new Error('API call failed');
      agentConfigService.getUserUsingCI = jest.fn().mockRejectedValue(mockError);
      agentConfigService.getOrgInfo = jest.fn().mockResolvedValue({});
      agentConfigService.getOrganizationSetting = jest.fn().mockResolvedValue({});
      agentConfigService.getTenantData = jest.fn().mockResolvedValue({});
      agentConfigService.getURLMapping = jest.fn().mockResolvedValue({});
      agentConfigService.getAllAuxCodes = jest.fn().mockResolvedValue({});
      agentConfigService.getDesktopProfileById = jest.fn().mockResolvedValue({});
      agentConfigService.getDialPlanData = jest.fn().mockResolvedValue({});
      agentConfigService.getAllTeams = jest.fn().mockResolvedValue({});

      await expect(agentConfigService.getAgentConfig(mockOrgId, mockAgentId)).rejects.toThrow(
        'API call failed'
      );
    });
  });
});

import {WebexSDK} from '../../../../../src/types';
import AgentConfigService from '../../../../../src/services/config';
import WebexRequest from '../../../../../src/services/core/WebexRequest';
import {WCC_API_GATEWAY} from '../../../../../src/services/constants';
import {CONFIG_FILE_NAME} from '../../../../../src/constants';
import MockWebex from '@webex/test-helper-mock-webex';
import LoggerProxy from '../../../../../src/logger-proxy';
import * as util from '../../../../../src/services/config/Util';
import {DEFAULT_AUXCODE_ATTRIBUTES} from '../../../../../src/services/config/constants';

jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

describe('AgentConfigService', () => {
  let agentConfigService: AgentConfigService;
  let webex: WebexSDK;
  let mockWebexRequest: WebexRequest;
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

    mockWebexRequest = WebexRequest.getInstance({webex});
    mockWebexRequest.request = jest.fn();

    agentConfigService = new AgentConfigService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrgDesktopLoginConfig', () => {
    it('should return OrgDesktopLoginResponse on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          organization: {tenantId: 'tenant123', timezone: 'America/New_York'},
          organizationSetting: {webRtcEnabled: true},
          tenantConfiguration: {forceDefaultDn: false},
          urlMappings: {},
          aiFeature: {realtimeTranscripts: {enable: false}},
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOrgDesktopLoginConfig(mockOrgId);

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/desktop-login`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Fetching organization desktop-login configuration',
        {
          module: CONFIG_FILE_NAME,
          method: 'getOrgDesktopLoginConfig',
        }
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOrgDesktopLoginConfig api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOrgDesktopLoginConfig',
      });
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(agentConfigService.getOrgDesktopLoginConfig(mockOrgId)).rejects.toThrow(
        'API call failed'
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getOrgDesktopLoginConfig API call failed with Error: API call failed',
        {module: CONFIG_FILE_NAME, method: 'getOrgDesktopLoginConfig'}
      );
    });

    it('should throw an error if the call fails with other than 200', async () => {
      (mockWebexRequest.request as jest.Mock).mockResolvedValue({statusCode: 403});

      await expect(agentConfigService.getOrgDesktopLoginConfig(mockOrgId)).rejects.toThrow(
        'API call failed with 403'
      );
    });
  });

  describe('getUserDesktopLoginConfig', () => {
    it('should return UserDesktopLoginResponse on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          user: {
            ciUserId: mockAgentId,
            dbId: 'db123',
            firstName: 'John',
            lastName: 'Doe',
            agentProfileId: 'profile123',
            email: 'john.doe@example.com',
            siteId: 'site123',
          },
          agentProfile: {accessIdleCode: 'ALL', dialPlanEnabled: true},
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getUserDesktopLoginConfig(mockOrgId, mockAgentId);

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/user/by-ci-user-id/${mockAgentId}/desktop-login`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching user desktop-login configuration', {
        module: CONFIG_FILE_NAME,
        method: 'getUserDesktopLoginConfig',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('getUserDesktopLoginConfig api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getUserDesktopLoginConfig',
      });
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(
        agentConfigService.getUserDesktopLoginConfig(mockOrgId, mockAgentId)
      ).rejects.toThrow('API call failed');
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getUserDesktopLoginConfig API call failed with Error: API call failed',
        {module: CONFIG_FILE_NAME, method: 'getUserDesktopLoginConfig'}
      );
    });

    it.each([403, 404])('should throw an error if the call fails with %i', async (statusCode) => {
      (mockWebexRequest.request as jest.Mock).mockResolvedValue({statusCode});

      await expect(
        agentConfigService.getUserDesktopLoginConfig(mockOrgId, mockAgentId)
      ).rejects.toThrow(`API call failed with ${statusCode}`);
    });
  });

  describe('getListOfTeams', () => {
    const page = 0;
    const pageSize = 10;
    const userDbId = 'db123';

    it('should filter by unquoted userId and return teams on success', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          data: [{id: '123', name: 'Team 1', multiMediaProfileId: 'mm1', siteName: 'Site 1'}],
          meta: {totalPages: 1},
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfTeams(mockOrgId, page, pageSize, userDbId);

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/team?page=${page}&pageSize=${pageSize}&agentView=true&filter=userId==${userDbId}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching list of teams', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfTeams',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('getListOfTeams api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfTeams',
      });
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexRequest.request as jest.Mock).mockRejectedValue(mockError);

      try {
        await agentConfigService.getListOfTeams(mockOrgId, page, pageSize, userDbId);
      } catch (error) {
        expect(error).toEqual(mockError);
      }
    });

    it('should throw an error if the getListOfTeams call fails with other than 200', async () => {
      const mockResponse = {
        statusCode: 400,
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getListOfTeams(mockOrgId, page, pageSize, userDbId);
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
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getListOfAuxCodes(
        mockOrgId,
        page,
        pageSize,
        filter,
        attributes
      );

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}&filter=id=in=(${filter})&attributes=${attributes}&desktopProfileFilter=true`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching list of aux codes', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfAuxCodes',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('getListOfAuxCodes api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfAuxCodes',
      });
    });

    it('should throw an error if the API call fails', async () => {
      const mockError = new Error('API call failed');
      (mockWebexRequest.request as jest.Mock).mockRejectedValue(mockError);
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
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      try {
        await agentConfigService.getListOfAuxCodes(mockOrgId, page, pageSize, filter, attributes);
      } catch (error) {
        expect(error).toEqual(new Error(`API call failed with ${mockResponse.statusCode}`));
      }
    });
  });

  describe(`getDialPlanData`, () => {
    it('should return dial plan data successfully', async () => {
      const mockResponse = {statusCode: 200, body: {data: {}}}; // Adjust data accordingly
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const result = await agentConfigService.getDialPlanData(mockOrgId);
      expect(result).toEqual(mockResponse.body);
      expect(LoggerProxy.log).toHaveBeenCalledWith('getDialPlanData api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getDialPlanData',
      });
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const mockError = {statusCode: 500};
      mockWebexRequest.request.mockResolvedValue(mockError);

      await expect(agentConfigService.getDialPlanData(mockOrgId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getDialPlanData API call failed with Error: API call failed with 500',
        {module: CONFIG_FILE_NAME, method: 'getDialPlanData'}
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockWebexRequest.request.mockRejectedValue(networkError);

      await expect(agentConfigService.getDialPlanData(mockOrgId)).rejects.toThrow('Network Error');
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getDialPlanData API call failed with Error: Network Error',
        {module: CONFIG_FILE_NAME, method: 'getDialPlanData'}
      );
    });
  });

  describe(`getAllTeams`, () => {
    const userDbId = 'db123';

    it('should return all teams successfully', async () => {
      const pageSize = 10;

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
      (mockWebexRequest.request as jest.Mock)
        .mockResolvedValueOnce(mockResponseFirst)
        .mockResolvedValue(mockResponseOther);

      const result = await agentConfigService.getAllTeams(mockOrgId, pageSize, userDbId);
      expect(result).toEqual([
        ...mockResponseFirst.body.data,
        ...mockResponseOther.body.data,
        ...mockResponseOther.body.data,
      ]);

      expect(LoggerProxy.log).toHaveBeenCalledTimes(3);

      // Verify that each call was made with the expected message
      expect(LoggerProxy.log).toHaveBeenNthCalledWith(1, 'getListOfTeams api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfTeams',
      });
      expect(LoggerProxy.log).toHaveBeenNthCalledWith(2, 'getListOfTeams api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfTeams',
      });
      expect(LoggerProxy.log).toHaveBeenNthCalledWith(3, 'getListOfTeams api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfTeams',
      });
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const pageSize = 10;

      const mockError = {statusCode: 500};
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockError);

      await expect(agentConfigService.getAllTeams(mockOrgId, pageSize, userDbId)).rejects.toThrow(
        'API call failed with 500'
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getListOfTeams API call failed with Error: API call failed with 500',
        {module: CONFIG_FILE_NAME, method: 'getListOfTeams'}
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
      (mockWebexRequest.request as jest.Mock)
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

      expect(LoggerProxy.log).toHaveBeenCalledTimes(3);

      // Verify that each call was made with the expected message
      expect(LoggerProxy.log).toHaveBeenNthCalledWith(1, 'getListOfAuxCodes api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfAuxCodes',
      });
      expect(LoggerProxy.log).toHaveBeenNthCalledWith(2, 'getListOfAuxCodes api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfAuxCodes',
      });
      expect(LoggerProxy.log).toHaveBeenNthCalledWith(3, 'getListOfAuxCodes api success.', {
        module: CONFIG_FILE_NAME,
        method: 'getListOfAuxCodes',
      });
    });

    it('should throw an error if API call returns non-200 status code', async () => {
      const pageSize = 10;
      const filter = ['filter1'];
      const attributes = ['attribute1'];

      const mockError = {statusCode: 500};
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockError);

      await expect(
        agentConfigService.getAllAuxCodes(mockOrgId, pageSize, filter, attributes)
      ).rejects.toThrow('API call failed with 500');
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getListOfAuxCodes API call failed with Error: API call failed with 500',
        {
          module: CONFIG_FILE_NAME,
          method: 'getListOfAuxCodes',
        }
      );
    });
  });

  describe('getWellbeingBreakIdleCode', () => {
    it('uses the system-code query and finds the exact code across pages', async () => {
      (mockWebexRequest.request as jest.Mock)
        .mockResolvedValueOnce({
          statusCode: 200,
          body: {
            data: [
              {id: 'other', name: 'Other', active: true, isSystemCode: true, defaultCode: false},
            ],
            meta: {totalPages: 2},
          },
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          body: {
            data: [
              {
                id: 'wellbeing-code',
                name: 'WellbeingBreak',
                active: true,
                isSystemCode: true,
                defaultCode: false,
              },
            ],
            meta: {totalPages: 2},
          },
        });

      await expect(agentConfigService.getWellbeingBreakIdleCode(mockOrgId)).resolves.toEqual({
        id: 'wellbeing-code',
        name: 'WellbeingBreak',
        isSystem: true,
        isDefault: false,
      });
      expect(mockWebexRequest.request).toHaveBeenNthCalledWith(1, {
        service: mockWccAPIURL,
        resource:
          `organization/${mockOrgId}/v2/auxiliary-code?page=0&pageSize=100` +
          '&workType=IDLE_CODE&customFilter=isSystemCode==true&desktopProfileFilter=false',
        method: 'GET',
      });
      expect(mockWebexRequest.request).toHaveBeenNthCalledWith(2, {
        service: mockWccAPIURL,
        resource:
          `organization/${mockOrgId}/v2/auxiliary-code?page=1&pageSize=100` +
          '&workType=IDLE_CODE&customFilter=isSystemCode==true&desktopProfileFilter=false',
        method: 'GET',
      });
    });

    it('rejects when the exact system code is unavailable', async () => {
      (mockWebexRequest.request as jest.Mock).mockResolvedValue({
        statusCode: 200,
        body: {
          data: [
            {id: 'inactive', name: 'WellbeingBreak', active: false, isSystemCode: true},
            {id: 'lookalike', name: 'wellbeingbreak', active: true, isSystemCode: true},
          ],
          meta: {totalPages: 1},
        },
      });

      await expect(agentConfigService.getWellbeingBreakIdleCode(mockOrgId)).rejects.toThrow(
        'WELLBEING_BREAK_IDLE_CODE_NOT_FOUND'
      );
    });
  });

  describe('getAgentConfig', () => {
    const mockSiteInfo = {
      id: 'c6a5451f-5ba7-49a1-aee8-fbef70c19ece',
      name: 'Site-1',
      multimediaProfileId: 'c5888e6f-5661-4871-9936-cbcec7658d41',
    };

    const mockOrgConfig = {
      organization: {tenantId: 'tenant123', timezone: 'GMT'},
      organizationSetting: {
        campaignManagerEnabled: true,
        webRtcEnabled: true,
        maskSensitiveData: false,
      },
      tenantConfiguration: {
        timeoutDesktopInactivityEnabled: false,
        forceDefaultDn: true,
        dnDefaultRegex: 'regexUS',
        dnOtherRegex: 'regexOther',
        privacyShieldVisible: true,
        outdialEnabled: true,
        endCallEnabled: true,
        endConsultEnabled: true,
        callVariablesSuppressed: false,
        lostConnectionRecoveryTimeout: 120000,
      },
      urlMappings: {},
      aiFeature: {realtimeTranscripts: {enable: true}},
      webexConfig: {showUserDetails: false, stateSynchronization: true},
    };

    const mockUser = {
      ciUserId: 'agent001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      agentProfileId: 'profile123',
      skillProfileId: 'skillProfile456',
      siteId: 'site789',
      dbId: 'db123',
      deafultDialledNumber: '1234567890',
      id: 'user001',
    };

    const mockAgentProfile = {
      timeoutDesktopInactivityCustomEnabled: true,
      timeoutDesktopInactivityMins: 10,
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'ALL',
      autoWrapUp: true,
      autoWrapAfterSeconds: 30,
      lastAgentRouting: true,
      allowAutoWrapUpExtension: false,
      outdialEnabled: true,
      dialPlanEnabled: false,
      agentAvailableAfterOutdial: true,
      outdialEntryPointId: 'entryPoint123',
      consultToQueue: true,
      viewableStatistics: {agentStats: true},
      addressBookId: 'addressBook123',
      outdialANIId: 'ani123',
      loginVoiceOptions: ['BROWSER', 'EXTENSION'],
      agentDNValidation: 'PROVISIONED_VALUE',
    };

    const mockTeamData = [
      {id: 'team1', name: 'Support Team', multiMediaProfileId: 'mmTeam123'},
    ];

    const mockAuxCodes = [
      {id: 'aux1', workTypeCode: 'WRAP_UP_CODE', name: 'Wrap Up Code 1', active: true},
      {id: 'aux2', workTypeCode: 'IDLE_CODE', name: 'Idle Code 1', active: true},
    ];

    const mockDialPlanData = [
      {
        id: 'dialPlan1',
        name: 'Plan 1',
        regularExpression: '[0-9]+',
        prefix: '1',
        strippedChars: '( )-',
        active: true,
      },
    ];

    /** Stubs every call getAgentConfig makes, so each test overrides only what it exercises. */
    const stubConfigCalls = ({
      agentProfile = mockAgentProfile,
      teamData = mockTeamData,
    }: {agentProfile?: object; teamData?: object[]} = {}) => {
      agentConfigService.getOrgDesktopLoginConfig = jest.fn().mockResolvedValue(mockOrgConfig);
      agentConfigService.getUserDesktopLoginConfig = jest
        .fn()
        .mockResolvedValue({user: mockUser, agentProfile});
      agentConfigService.getAllAuxCodes = jest.fn().mockResolvedValue(mockAuxCodes);
      agentConfigService.getSiteInfo = jest.fn().mockResolvedValue(mockSiteInfo);
      agentConfigService.getAllTeams = jest.fn().mockResolvedValue(teamData);
      agentConfigService.getDialPlanData = jest.fn().mockResolvedValue(mockDialPlanData);
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should fetch and parse agent configuration successfully', async () => {
      const parseAgentConfigsSpy = jest.spyOn(util, 'parseAgentConfigs');
      stubConfigCalls();

      await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(LoggerProxy.info).toHaveBeenCalledWith(
        `Fetched user data, userId: ${mockUser.ciUserId}`,
        {
          module: CONFIG_FILE_NAME,
          method: 'getAgentConfig',
        }
      );
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetched all required data', {
        module: CONFIG_FILE_NAME,
        method: 'getAgentConfig',
      });
      expect(LoggerProxy.info).toHaveBeenCalledWith('Parsing completed for agent-config', {
        module: CONFIG_FILE_NAME,
        method: 'getAgentConfig',
      });
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetched configuration data successfully', {
        module: CONFIG_FILE_NAME,
        method: 'getAgentConfig',
      });
      expect(parseAgentConfigsSpy).toHaveBeenCalledTimes(1);

      expect(parseAgentConfigsSpy).toHaveBeenCalledWith({
        orgConfig: mockOrgConfig,
        userData: mockUser,
        agentProfileData: mockAgentProfile,
        teamData: mockTeamData,
        auxCodes: mockAuxCodes,
        dialPlanData: [],
        multimediaProfileId: 'mmTeam123',
      });
    });

    it('should request both aggregates and the aux-code pool for the given org and agent', async () => {
      stubConfigCalls();

      await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(agentConfigService.getOrgDesktopLoginConfig).toHaveBeenCalledWith(mockOrgId);
      expect(agentConfigService.getUserDesktopLoginConfig).toHaveBeenCalledWith(
        mockOrgId,
        mockAgentId
      );
      expect(agentConfigService.getAllAuxCodes).toHaveBeenCalledWith(
        mockOrgId,
        100,
        [],
        DEFAULT_AUXCODE_ATTRIBUTES
      );
    });

    it('should query teams by the user dbId and the site by the user siteId', async () => {
      stubConfigCalls();

      await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(agentConfigService.getAllTeams).toHaveBeenCalledWith(mockOrgId, 100, mockUser.dbId);
      expect(agentConfigService.getSiteInfo).toHaveBeenCalledWith(mockOrgId, mockUser.siteId);
    });

    it.each([
      {dialPlanEnabled: true, expectedCalls: 1},
      {dialPlanEnabled: false, expectedCalls: 0},
    ])(
      'should issue the dial-plan call $expectedCalls time(s) when dialPlanEnabled is $dialPlanEnabled',
      async ({dialPlanEnabled, expectedCalls}) => {
        stubConfigCalls({agentProfile: {...mockAgentProfile, dialPlanEnabled}});

        await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

        expect(agentConfigService.getDialPlanData).toHaveBeenCalledTimes(expectedCalls);
      }
    );

    it.each([
      {
        scenario: 'the team value when the agent has a team',
        teamData: mockTeamData,
        expected: 'mmTeam123',
      },
      {
        scenario: 'the site value when the agent has no team',
        teamData: [],
        expected: mockSiteInfo.multimediaProfileId,
      },
      {
        scenario: 'the site value when the team carries no multimedia profile',
        teamData: [{id: 'team1', name: 'Support Team'}],
        expected: mockSiteInfo.multimediaProfileId,
      },
    ])('should resolve multimediaProfileId to $scenario', async ({teamData, expected}) => {
      const parseAgentConfigsSpy = jest.spyOn(util, 'parseAgentConfigs');
      stubConfigCalls({teamData});

      await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(parseAgentConfigsSpy).toHaveBeenCalledWith(
        expect.objectContaining({multimediaProfileId: expected})
      );
    });

    it('should build the dial plan from the dial-plan response when dial planning is enabled', async () => {
      const parseAgentConfigsSpy = jest.spyOn(util, 'parseAgentConfigs');
      stubConfigCalls({agentProfile: {...mockAgentProfile, dialPlanEnabled: true}});

      const result = await agentConfigService.getAgentConfig(mockOrgId, mockAgentId);

      expect(parseAgentConfigsSpy).toHaveBeenCalledWith(
        expect.objectContaining({dialPlanData: mockDialPlanData})
      );
      expect(result.dialPlan).toEqual({
        type: 'adhocDial',
        dialPlanEntity: [{regex: '[0-9]+', prefix: '1', strippedChars: '( )-', name: 'Plan 1'}],
      });
    });

    it.each([
      'getOrgDesktopLoginConfig',
      'getUserDesktopLoginConfig',
      'getAllAuxCodes',
      'getSiteInfo',
      'getAllTeams',
    ])('should throw an error if %s fails', async (failingCall) => {
      const mockError = new Error('API call failed');
      stubConfigCalls();
      agentConfigService[failingCall] = jest.fn().mockRejectedValue(mockError);

      await expect(agentConfigService.getAgentConfig(mockOrgId, mockAgentId)).rejects.toThrow(
        'API call failed'
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getAgentConfig call failed with Error: API call failed',
        {module: CONFIG_FILE_NAME, method: 'getAgentConfig'}
      );
    });
  });

  describe('getOutdialAniEntries', () => {
    const mockOutdialANI = 'ani-123-456';
    const mockError = new Error('API call failed');

    it('should return outdial ANI entries on success with minimal parameters', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          data: [
            {
              id: '142fba3c-8502-4446-bf6e-584fd657553a',
              name: 'Second Entry',
              number: '+19403016307',
              links: [],
              createdTime: 1759227334000,
              lastUpdatedTime: 1759227334000,
            },
            {
              id: '6f53000b-e04a-4418-9de9-ba511d2367cb',
              name: 'Sandbox OutDial -entry-iycx',
              number: '+19403016307',
              links: [],
              createdTime: 1755185421000,
              lastUpdatedTime: 1759227334000,
            },
          ],
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
      });

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body.data);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching outdial ANI entries', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
    });

    it('should return outdial ANI entries on success with all parameters', async () => {
      const page = 1;
      const pageSize = 50;
      const search = 'test';
      const filter = 'active=true';
      const attributes = 'number,name,id';

      const mockResponse = {
        statusCode: 200,
        body: {
          data: [
            {
              id: '142fba3c-8502-4446-bf6e-584fd657553a',
              name: 'Test Entry',
              number: '+19403016307',
            },
          ],
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
        page,
        pageSize,
        search,
        filter,
        attributes,
      });

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry?page=${page}&pageSize=${pageSize}&search=${search}&filter=${filter}&attributes=${attributes}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body.data);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching outdial ANI entries', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
    });

    it('should return outdial ANI entries with partial parameters', async () => {
      const page = 0;
      const pageSize = 25;
      const attributes = 'number,name';

      const mockResponse = {
        statusCode: 200,
        body: {
          data: [
            {
              id: '142fba3c-8502-4446-bf6e-584fd657553a',
              name: 'Partial Entry',
              number: '+19403016307',
            },
          ],
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
        page,
        pageSize,
        attributes,
      });

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry?page=${page}&pageSize=${pageSize}&attributes=${attributes}`,
        method: 'GET',
      });
      expect(result).toEqual(mockResponse.body.data);
    });

    it('should return empty array when no ANI entries found', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          data: [],
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
      });

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry`,
        method: 'GET',
      });
      expect(result).toEqual([]);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching outdial ANI entries', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
    });

    it('should throw an error if the API call fails', async () => {
      (mockWebexRequest.request as jest.Mock).mockRejectedValue(mockError);

      await expect(
        agentConfigService.getOutdialAniEntries(mockOrgId, {outdialANI: mockOutdialANI})
      ).rejects.toThrow('API call failed');

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getOutdialAniEntries API call failed with Error: API call failed',
        {module: CONFIG_FILE_NAME, method: 'getOutdialAniEntries'}
      );
      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry`,
        method: 'GET',
      });
    });

    it('should return undefined when API call returns a non-200 status code', async () => {
      const mockResponse = {statusCode: 404};
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
      });

      expect(result).toBeUndefined();
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry`,
        method: 'GET',
      });
    });

    it('should return undefined when API call returns a 500 status code', async () => {
      const mockResponse = {statusCode: 500};
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
      });

      expect(result).toBeUndefined();
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry`,
        method: 'GET',
      });
    });

    it('should handle undefined response body gracefully', async () => {
      const mockResponse = {
        statusCode: 200,
        body: undefined,
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
      });

      expect(result).toBeUndefined();
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
    });

    it('should handle response body without data property', async () => {
      const mockResponse = {
        statusCode: 200,
        body: {
          message: 'No data available',
        },
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
      });

      expect(result).toBeUndefined();
      expect(LoggerProxy.log).toHaveBeenCalledWith('getOutdialAniEntries API success.', {
        module: CONFIG_FILE_NAME,
        method: 'getOutdialAniEntries',
      });
    });

    it('should properly encode special characters in parameters', async () => {
      const search = 'test search with spaces';
      const filter = 'name=contains("test & special")';

      const mockResponse = {
        statusCode: 200,
        body: {data: []},
      };
      (mockWebexRequest.request as jest.Mock).mockResolvedValue(mockResponse);

      await agentConfigService.getOutdialAniEntries(mockOrgId, {
        outdialANI: mockOutdialANI,
        page: 0,
        pageSize: 10,
        search,
        filter,
      });

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: mockWccAPIURL,
        resource: `organization/${mockOrgId}/v2/outdial-ani/${mockOutdialANI}/entry?page=0&pageSize=10&search=${search}&filter=${filter}`,
        method: 'GET',
      });
    });
  });
});

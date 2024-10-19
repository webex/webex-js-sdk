import AgentConfig from '../../../../src/AgentConfig/AgentConfig';
import { WebexSDK } from '../../../../src/types';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from '../../../../src/AgentConfigService/types';

jest.mock('../AgentConfigService/AgentConfigService'); // Mock the AgentConfigService

const mockWebex: WebexSDK = {
  credentials: {
    getOrgId: jest.fn(),
  },
  logger: {
    log: jest.fn(),
  },
};

describe('AgentConfig', () => {
  let agentConfig: AgentConfig;
  const ciUserId = 'test-ci-user-id';
  const wccAPIURL = 'https://api.example.com';
  const orgId = 'test-org-id';

  beforeEach(() => {
    mockWebex.credentials.getOrgId.mockResolvedValue(orgId);
    agentConfig = new AgentConfig(ciUserId, mockWebex, wccAPIURL);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch agent profile successfully', async () => {
    const mockUserResponse: UserResponse = {
      agentProfileId: 'test-profile-id',
      teamIds: ['team1', 'team2'],
      userProfileId: 'test-user-profile-id',
    };

    const mockDesktopProfileResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1'],
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'ALL',
      wrapUpCodes: ['wrap1'],
      idleCodes: ['idle1'],
    };

    const mockListTeamsResponse: ListTeamsResponse[] = [
      { id: 'team1', name: 'Team One' },
      { id: 'team2', name: 'Team Two' },
    ];

    const mockListAuxCodesResponse: ListAuxCodesResponse = {
      data: [
        { id: 'aux1', active: true, defaultCode: false, isSystemCode: false, description: 'desc1', name: 'Aux Code 1', workTypeCode: 'WRAP_UP_CODE' },
        { id: 'aux2', active: true, defaultCode: false, isSystemCode: false, description: 'desc2', name: 'Aux Code 2', workTypeCode: 'IDLE_CODE' },
      ],
    };

    (AgentConfigService as jest.Mock).mockImplementation(() => ({
      getUserUsingCI: jest.fn().mockResolvedValue(mockUserResponse),
      getDesktopProfileById: jest.fn().mockResolvedValue(mockDesktopProfileResponse),
      getListOfTeams: jest.fn().mockResolvedValue(mockListTeamsResponse),
      getListOfAuxCodes: jest.fn().mockResolvedValue(mockListAuxCodesResponse),
    }));

    const agentProfile = await agentConfig.getAgentProfile();

    expect(mockWebex.credentials.getOrgId).toHaveBeenCalled();
    expect(agentProfile.teams).toEqual([mockListTeamsResponse]);
    expect(agentProfile.loginVoiceOptions).toEqual(['option1']);
    expect(agentProfile.wrapUpCodes).toEqual([{ id: 'aux1', active: true, defaultCode: false, isSystemCode: false, description: 'desc1', name: 'Aux Code 1', workTypeCode: 'WRAP_UP_CODE' }]);
    expect(agentProfile.idleCodes).toEqual([{ id: 'aux2', active: true, defaultCode: false, isSystemCode: false, description: 'desc2', name: 'Aux Code 2', workTypeCode: 'IDLE_CODE' }]);
  });

  it('should handle error if fetching agent profile fails', async () => {
    const errorMessage = 'Test error';
    mockWebex.credentials.getOrgId.mockRejectedValueOnce(new Error(errorMessage));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow(`Error while fetching agent profile, Error: ${errorMessage}`);
  });

  it('should handle specific cases of accessIdleCode and accessWrapUpCode', async () => {
    const mockUserResponse: UserResponse = {
      agentProfileId: 'test-profile-id',
      teamIds: ['team1', 'team2'],
      userProfileId: 'test-user-profile-id',
    };

    const mockDesktopProfileResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1'],
      accessWrapUpCode: 'NOT_ALL',
      accessIdleCode: 'ALL',
      wrapUpCodes: ['wrap1'],
      idleCodes: ['idle1'],
    };

    const mockListTeamsResponse: ListTeamsResponse[] = [
      { id: 'team1', name: 'Team One' },
      { id: 'team2', name: 'Team Two' },
    ];

    const mockListAuxCodesResponse: ListAuxCodesResponse = {
      data: [
        { id: 'aux1', active: true, defaultCode: false, isSystemCode: false, description: 'desc1', name: 'Aux Code 1', workTypeCode: 'WRAP_UP_CODE' },
        { id: 'aux2', active: true, defaultCode: false, isSystemCode: false, description: 'desc2', name: 'Aux Code 2', workTypeCode: 'IDLE_CODE' },
      ],
    };

    (AgentConfigService as jest.Mock).mockImplementation(() => ({
      getUserUsingCI: jest.fn().mockResolvedValue(mockUserResponse),
      getDesktopProfileById: jest.fn().mockResolvedValue(mockDesktopProfileResponse),
      getListOfTeams: jest.fn().mockResolvedValue(mockListTeamsResponse),
      getListOfAuxCodes: jest.fn().mockResolvedValue(mockListAuxCodesResponse),
    }));

    const agentProfile = await agentConfig.getAgentProfile();

    expect(mockWebex.credentials.getOrgId).toHaveBeenCalled();
    expect(agentProfile.teams).toEqual([mockListTeamsResponse]);
    expect(agentProfile.loginVoiceOptions).toEqual(['option1']);
    expect(agentProfile.wrapUpCodes).toEqual([{ id: 'aux1', active: true, defaultCode: false, isSystemCode: false, description: 'desc1', name: 'Aux Code 1', workTypeCode: 'WRAP_UP_CODE' }]);
    expect(agentProfile.idleCodes).toEqual([{ id: 'aux2', active: true, defaultCode: false, isSystemCode: false, description: 'desc2', name: 'Aux Code 2', workTypeCode: 'IDLE_CODE' }]);
  });

});
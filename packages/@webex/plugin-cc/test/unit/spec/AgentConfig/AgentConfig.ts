import AgentConfig from '../../../../src/AgentConfig/AgentConfig';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';

// Mocking dependencies.
jest.mock('../AgentConfigService/AgentConfigService');
jest.mock('../WebexSDK');

describe('AgentConfig', () => {
  let webexMock;
  let agentConfigServiceMock;

  beforeEach(() => {
    webexMock = {
      credentials: {
        getOrgId: jest.fn().mockResolvedValue('orgId123')
      }
    };

    agentConfigServiceMock = {
      getUserUsingCI: jest.fn(),
      getDesktopProfileById: jest.fn(),
      getListOfTeams: jest.fn(),
      getListOfAuxCodes: jest.fn()
    };

    AgentConfigService.mockImplementation(() => agentConfigServiceMock);
  });

  it('should get agent profile successfully', async () => {
    const agentConfig = new AgentConfig('agentId123', webexMock, 'wccAPIURL123');
    
    const userResponse = { agentProfileId: 'profileId123', teamIds: ['team1', 'team2'] };
    const desktopProfileResponse = { 
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'ALL',
      wrapUpCodes: [],
      idleCodes: []
    };
    const teamsListResponse = { data: ['team1', 'team2'] };
    const auxCodesListResponse = { data: [
      { workTypeCode: 'WRAP_UP_CODE', code: 'wrap1' },
      { workTypeCode: 'IDLE_CODE', code: 'idle1' }
    ] };

    agentConfigServiceMock.getUserUsingCI.mockResolvedValue(userResponse);
    agentConfigServiceMock.getDesktopProfileById.mockResolvedValue(desktopProfileResponse);
    agentConfigServiceMock.getListOfTeams.mockResolvedValue(teamsListResponse);
    agentConfigServiceMock.getListOfAuxCodes.mockResolvedValue(auxCodesListResponse);

    const expectedProfile = {
      teams: [teamsListResponse],
      loginVoiceOptions: ['option1', 'option2'],
      idleCodes: [{ workTypeCode: 'IDLE_CODE', code: 'idle1' }],
      wrapUpCodes: [{ workTypeCode: 'WRAP_UP_CODE', code: 'wrap1' }]
    };

    const result = await agentConfig.getAgentProfile();
    expect(result).toEqual(expectedProfile);
  });

  it('should handle errors gracefully', async () => {
    const agentConfig = new AgentConfig('agentId123', webexMock, 'wccAPIURL123');

    agentConfigServiceMock.getUserUsingCI.mockRejectedValue(new Error('Test Error'));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow('Error while fetching agent profile, Error: Test Error');
  });
});
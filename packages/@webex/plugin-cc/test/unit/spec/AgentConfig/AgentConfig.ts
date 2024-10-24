import {IAgentConfig} from '../../../../src/AgentConfig/types';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';
import { WebexSDK } from '../../../../src/types';
import { WORK_TYPE_CODE } from '../../../../src/AgentConfig/types';
import AgentConfig from '../../../../src/AgentConfig/AgentConfig';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  AgentResponse,
} from '../../../../src/AgentConfigService/types';

// Mocking the WebexSDK instance
const mockWebex: WebexSDK = {
  internal: {
    device: {
      orgId: 'testOrgId',
    },
  },
};

// Mock data
const mockAgentResponse: AgentResponse = {
  firstName: 'John',
  lastName: 'Doe',
  agentProfileId: 'profile123',
  email: 'john.doe@example.com',
  teamIds: ['team1', 'team2'],
};

const mockDesktopProfileResponse: DesktopProfileResponse = {
  loginVoiceOptions: ['option1', 'option2'],
  accessWrapUpCode: 'ALL',
  accessIdleCode: 'ALL',
  wrapUpCodes: [],
  idleCodes: [],
};

const mockTeamsListResponse: ListTeamsResponse = {
  data: [{ id: 'team1', name: 'Team 1' }],
};

const mockAuxCodesResponse: ListAuxCodesResponse = {
  data: [
    { id: 'aux1', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE },
    { id: 'aux2', workTypeCode: WORK_TYPE_CODE.IDLE_CODE },
  ],
};

describe('AgentConfig', () => {
  let agentConfig: AgentConfig;
  let getUserUsingCIMock: jest.SpyInstance;
  let getDesktopProfileByIdMock: jest.SpyInstance;
  let getListOfTeamsMock: jest.SpyInstance;
  let getListOfAuxCodesMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    agentConfig = new AgentConfig('agent123', mockWebex, 'http://api.url');

    // Mocking methods of AgentConfigService
    getUserUsingCIMock = jest.spyOn(AgentConfigService.prototype, 'getUserUsingCI').mockResolvedValue(mockAgentResponse);
    getDesktopProfileByIdMock = jest.spyOn(AgentConfigService.prototype, 'getDesktopProfileById').mockResolvedValue(mockDesktopProfileResponse);
    getListOfTeamsMock = jest.spyOn(AgentConfigService.prototype, 'getListOfTeams').mockResolvedValue(mockTeamsListResponse);
    getListOfAuxCodesMock = jest.spyOn(AgentConfigService.prototype, 'getListOfAuxCodes').mockResolvedValue(mockAuxCodesResponse);
  });

  it('should fetch agent profile successfully', async () => {
    const expectedProfile: IAgentConfig = {
      agentId: 'agent123',
      agentFirstName: 'John',
      agentLastName: 'Doe',
      agentProfileId: 'profile123',
      agentMailId: 'john.doe@example.com',
      teams: [mockTeamsListResponse],
      loginVoiceOptions: ['option1', 'option2'],
      wrapUpCodes: [{ id: 'aux1', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE }],
      idleCodes: [{ id: 'aux2', workTypeCode: WORK_TYPE_CODE.IDLE_CODE }],
    };

    const result = await agentConfig.getAgentProfile();
    expect(result).toEqual(expectedProfile);
    expect(getUserUsingCIMock).toHaveBeenCalledTimes(1);
    expect(getDesktopProfileByIdMock).toHaveBeenCalledTimes(1);
    expect(getListOfTeamsMock).toHaveBeenCalledTimes(1);
    expect(getListOfAuxCodesMock).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when fetching agent profile', async () => {
    getUserUsingCIMock.mockRejectedValue(new Error('Network error'));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow(
      'Error while fetching agent profile, Error: Network error'
    );
  });
});
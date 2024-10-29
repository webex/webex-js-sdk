import { IAgentProfile } from '../../../../src/AgentConfig/types';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';
import { WebexSDK } from '../../../../src/types';
import { WORK_TYPE_CODE } from '../../../../src/AgentConfig/types';
import AgentConfig from '../../../../src/AgentConfig/AgentConfig';
import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  Team,
  AgentResponse,
} from '../../../../src/AgentConfigService/types';

const mockWebex: WebexSDK = {
  internal: {
    device: {
      orgId: 'testOrgId',
    },
  },
};

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

const mockTeamsListResponse: Team[] = [{ id: '123', name: 'Team 1' }];

const mockAuxCodesResponse: ListAuxCodesResponse = {
  data: [
    { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE,},
    { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE,}
  ],
};

describe('AgentConfig', () => {
  let agentConfig: AgentConfig;
  let getUserUsingCISpy: jest.SpyInstance;
  let getDesktopProfileByIdSpy: jest.SpyInstance;
  let getListOfTeamsSpy: jest.SpyInstance;
  let getListOfAuxCodesSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    agentConfig = new AgentConfig('agent123', mockWebex, 'http://api.url');

    getUserUsingCISpy = jest.spyOn(AgentConfigService.prototype, 'getUserUsingCI').mockResolvedValue(mockAgentResponse);
    getDesktopProfileByIdSpy = jest.spyOn(AgentConfigService.prototype, 'getDesktopProfileById').mockResolvedValue(mockDesktopProfileResponse);
    getListOfAuxCodesSpy = jest.spyOn(AgentConfigService.prototype, 'getListOfAuxCodes').mockResolvedValue(mockAuxCodesResponse);
    getListOfTeamsSpy = jest.spyOn(AgentConfigService.prototype, 'getListOfTeams').mockResolvedValue(mockTeamsListResponse);
  });

  it('should fetch agent profile successfully', async () => {
    const page = 0;
    const pageSize = 10;
    const auxCodeFilter = [...mockDesktopProfileResponse.idleCodes, ...mockDesktopProfileResponse.wrapUpCodes];
    const attributes = ['id', 'name'];

    const expectedProfile: IAgentProfile = {
      agentId: 'agent123',
      agentName: 'John Doe',
      agentProfileId: 'profile123',
      agentMailId: 'john.doe@example.com',
      teams: mockTeamsListResponse,
      loginVoiceOptions: ['option1', 'option2'],
      wrapUpCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE}],
      idleCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE}]
    };

    const result = await agentConfig.getAgentProfile();

    expect(getUserUsingCISpy).toHaveBeenCalledTimes(1);
    expect(getUserUsingCISpy).toHaveBeenCalledWith();

    expect(getDesktopProfileByIdSpy).toHaveBeenCalledTimes(1);
    expect(getDesktopProfileByIdSpy).toHaveBeenCalledWith(mockAgentResponse.agentProfileId);

    expect(getListOfTeamsSpy).toHaveBeenCalledTimes(1);
    expect(getListOfTeamsSpy).toHaveBeenCalledWith(page, pageSize, mockAgentResponse.teamIds, attributes);

    expect(getListOfAuxCodesSpy).toHaveBeenCalledTimes(1);
    expect(getListOfAuxCodesSpy).toHaveBeenCalledWith(page, pageSize, auxCodeFilter, attributes);

    expect(result).toEqual(expectedProfile);
  });

  it('should handle errors when fetching agent profile', async () => {
    getUserUsingCISpy.mockRejectedValue(new Error('Network error'));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow(
      'Fetching Agent Profile failed: Network error'
    );
  });

  it('should handle errors when fetching desktop profile', async () => {
    getDesktopProfileByIdSpy.mockRejectedValue(new Error('API error'));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow(
      'Fetching Agent Profile failed: API error'
    );
  });

  it('should handle errors when fetching list of teams', async () => {
    getListOfTeamsSpy.mockRejectedValue(new Error('API error'));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow(
      'Fetching Agent Profile failed: API error'
    );
  });

  it('should handle errors when fetching list of aux codes', async () => {
    getListOfAuxCodesSpy.mockRejectedValue(new Error('API error'));

    await expect(agentConfig.getAgentProfile()).rejects.toThrow(
      'Fetching Agent Profile failed: API error'
    );
  });

  it('should handle both accessIdleCode and accessWrapUpCode as ALL', async () => {

    const page = 0;
    const pageSize = 10;
    const auxCodeFilter = [...mockDesktopProfileResponse.idleCodes, ...mockDesktopProfileResponse.wrapUpCodes];
    const attributes = ['id', 'name'];

    const allDesktopProfileResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'ALL',
      wrapUpCodes: [],
      idleCodes: [],
    };

    getDesktopProfileByIdSpy.mockResolvedValue(allDesktopProfileResponse);

    const allAuxCodesResponse: ListAuxCodesResponse = {
      data: [
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE},
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE}
      ],
    };

    getListOfAuxCodesSpy.mockResolvedValue(allAuxCodesResponse);

    const expectedProfile: IAgentProfile = {
      agentId: 'agent123',
      agentName: 'John Doe',
      agentProfileId: 'profile123',
      agentMailId: 'john.doe@example.com',
      teams: mockTeamsListResponse,
      loginVoiceOptions: ['option1', 'option2'],
      wrapUpCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE}],
      idleCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE}]
    };

    const result = await agentConfig.getAgentProfile();

    expect(getUserUsingCISpy).toHaveBeenCalledTimes(1);
    expect(getUserUsingCISpy).toHaveBeenCalledWith();

    expect(getDesktopProfileByIdSpy).toHaveBeenCalledTimes(1);
    expect(getDesktopProfileByIdSpy).toHaveBeenCalledWith(mockAgentResponse.agentProfileId);

    expect(getListOfTeamsSpy).toHaveBeenCalledTimes(1);
    expect(getListOfTeamsSpy).toHaveBeenCalledWith(page, pageSize, mockAgentResponse.teamIds, attributes);

    expect(getListOfAuxCodesSpy).toHaveBeenCalledTimes(1);
    expect(getListOfAuxCodesSpy).toHaveBeenCalledWith(page, pageSize, auxCodeFilter, attributes);

    expect(result).toEqual(expectedProfile);
  });

  it('should handle SPECIFIC accessIdleCode and accessWrapUpCode', async () => {

    const specificDesktopProfileResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'SPECIFIC',
      accessIdleCode: 'SPECIFIC',
      wrapUpCodes: ['aux1'],
      idleCodes: ['aux2'],
    };

    const page = 0;
    const pageSize = 10;
    const auxCodeFilter = [specificDesktopProfileResponse.wrapUpCodes, specificDesktopProfileResponse.idleCodes];
    const attributes = ['id', 'name'];

    getDesktopProfileByIdSpy.mockResolvedValue(specificDesktopProfileResponse);

    const specificAuxCodesResponse: ListAuxCodesResponse = {
      data: [
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE,},
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE,}
      ],
    };

    getListOfAuxCodesSpy.mockResolvedValue(specificAuxCodesResponse);

    const expectedProfile: IAgentProfile = {
      agentId: 'agent123',
      agentName: 'John Doe',
      agentProfileId: 'profile123',
      agentMailId: 'john.doe@example.com',
      teams: mockTeamsListResponse,
      loginVoiceOptions: ['option1', 'option2'],
      wrapUpCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE}],
      idleCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE}]
    };

    const result = await agentConfig.getAgentProfile();

    expect(getUserUsingCISpy).toHaveBeenCalledTimes(1);
    expect(getUserUsingCISpy).toHaveBeenCalledWith();

    expect(getDesktopProfileByIdSpy).toHaveBeenCalledTimes(1);
    expect(getDesktopProfileByIdSpy).toHaveBeenCalledWith(mockAgentResponse.agentProfileId);

    expect(getListOfTeamsSpy).toHaveBeenCalledTimes(1);
    expect(getListOfTeamsSpy).toHaveBeenCalledWith(page, pageSize, mockAgentResponse.teamIds, attributes);

    expect(getListOfAuxCodesSpy).toHaveBeenCalledTimes(1);
    expect(getListOfAuxCodesSpy).toHaveBeenCalledWith(page, pageSize, auxCodeFilter, attributes);

    expect(result).toEqual(expectedProfile);
  });

  it('should handle accessIdleCode as ALL and accessWrapUpCode as SPECIFIC', async () => {

    const page = 0;
    const pageSize = 10;
    const auxCodeFilter = [...mockDesktopProfileResponse.idleCodes, ...mockDesktopProfileResponse.wrapUpCodes];
    const attributes = ['id', 'name'];

    const mixedDesktopProfileResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'SPECIFIC',
      accessIdleCode: 'ALL',
      wrapUpCodes: ['aux1'],
      idleCodes: [],
    };

    getDesktopProfileByIdSpy.mockResolvedValue(mixedDesktopProfileResponse);

    const mixedAuxCodesResponse: ListAuxCodesResponse = {
      data: [
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE,},
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE,}
      ],
    };

    getListOfAuxCodesSpy.mockResolvedValue(mixedAuxCodesResponse);

    const expectedProfile: IAgentProfile = {
      agentId: 'agent123',
      agentName: 'John Doe',
      agentProfileId: 'profile123',
      agentMailId: 'john.doe@example.com',
      teams: mockTeamsListResponse,
      loginVoiceOptions: ['option1', 'option2'],
      wrapUpCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE}],
      idleCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE}]
    };

    const result = await agentConfig.getAgentProfile();

    expect(getUserUsingCISpy).toHaveBeenCalledTimes(1);
    expect(getUserUsingCISpy).toHaveBeenCalledWith();

    expect(getDesktopProfileByIdSpy).toHaveBeenCalledTimes(1);
    expect(getDesktopProfileByIdSpy).toHaveBeenCalledWith(mockAgentResponse.agentProfileId);

    expect(getListOfTeamsSpy).toHaveBeenCalledTimes(1);
    expect(getListOfTeamsSpy).toHaveBeenCalledWith(page, pageSize, mockAgentResponse.teamIds, attributes);

    expect(getListOfAuxCodesSpy).toHaveBeenCalledTimes(1);
    expect(getListOfAuxCodesSpy).toHaveBeenCalledWith(page, pageSize, auxCodeFilter, attributes);

    expect(result).toEqual(expectedProfile);
  });

  it('should handle accessIdleCode as SPECIFIC and accessWrapUpCode as ALL', async () => {

    const page = 0;
    const pageSize = 10;
    const auxCodeFilter = [...mockDesktopProfileResponse.idleCodes, ...mockDesktopProfileResponse.wrapUpCodes];
    const attributes = ['id', 'name'];

    const mixedDesktopProfileResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'SPECIFIC',
      wrapUpCodes: [],
      idleCodes: ['aux2'],
    };

    getDesktopProfileByIdSpy.mockResolvedValue(mixedDesktopProfileResponse);

    const mixedAuxCodesResponse: ListAuxCodesResponse = {
      data: [
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE,},
        { id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE,}
      ],
    };

    getListOfAuxCodesSpy.mockResolvedValue(mixedAuxCodesResponse);

    const expectedProfile: IAgentProfile = {
      agentId: 'agent123',
      agentName: 'John Doe',
      agentProfileId: 'profile123',
      agentMailId: 'john.doe@example.com',
      teams: mockTeamsListResponse,
      loginVoiceOptions: ['option1', 'option2'],
      wrapUpCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.WRAP_UP_CODE}],
      idleCodes: [{id: 'aux1', active: true, defaultCode: true, isSystemCode: true, description: 'test', name: 'testName', workTypeCode: WORK_TYPE_CODE.IDLE_CODE}]
    };

    const result = await agentConfig.getAgentProfile();

    expect(getUserUsingCISpy).toHaveBeenCalledTimes(1);
    expect(getUserUsingCISpy).toHaveBeenCalledWith();

    expect(getDesktopProfileByIdSpy).toHaveBeenCalledTimes(1);
    expect(getDesktopProfileByIdSpy).toHaveBeenCalledWith(mockAgentResponse.agentProfileId);

    expect(getListOfTeamsSpy).toHaveBeenCalledTimes(1);
    expect(getListOfTeamsSpy).toHaveBeenCalledWith(page, pageSize, mockAgentResponse.teamIds, attributes);

    expect(getListOfAuxCodesSpy).toHaveBeenCalledTimes(1);
    expect(getListOfAuxCodesSpy).toHaveBeenCalledWith(page, pageSize, auxCodeFilter, attributes);

    expect(result).toEqual(expectedProfile);
  });
});
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';
import { HTTP_METHODS} from '../../../../src/types';
import Request from '../../../../src/request';

// Mock dependencies
jest.mock('../request');

describe('AgentConfigService', () => {
  let webexMock;
  let requestMock;
  const wccAPIURL = 'https://api.example.com/';

  beforeEach(() => {
    webexMock = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
      credentials: {
        getUserToken: jest.fn().mockResolvedValue('fake-token'),
        getOrgId: jest.fn().mockResolvedValue('orgId123'),
      },
    };

    requestMock = {
      request: jest.fn(),
    };

    Request.mockImplementation(() => requestMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should get user using CI successfully', async () => {
    const ciUserId = 'ciUserId123';
    const orgId = 'orgId123';
    const userResponse = {
      agentProfileId: 'profileId123',
      teamIds: ['team1', 'team2'],
      userProfileId: 'userProfileId123',
    };

    requestMock.request.mockResolvedValue({ body: userResponse });

    const service = new AgentConfigService(ciUserId, orgId, webexMock, wccAPIURL);
    const result = await service.getUserUsingCI();

    expect(requestMock.request).toHaveBeenCalledWith(
      `${wccAPIURL}organization/${orgId}/user/by-ci-user-id/${ciUserId}`,
      HTTP_METHODS.GET
    );
    expect(result).toEqual(userResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('getUserUsingCI api called successfully.');
  });

  it('should handle error in getUserUsingCI', async () => {
    const ciUserId = 'ciUserId123';
    const orgId = 'orgId123';

    requestMock.request.mockRejectedValue(new Error('Test Error'));

    const service = new AgentConfigService(ciUserId, orgId, webexMock, wccAPIURL);

    await expect(service.getUserUsingCI()).rejects.toThrow('Error while calling getUserUsingCI API, Error: Test Error');
  });

  it('should get desktop profile by id successfully', async () => {
    const orgId = 'orgId123';
    const desktopProfileId = 'profileId123';
    const desktopProfileResponse = {
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'ALL',
      wrapUpCodes: [],
      idleCodes: [],
    };

    requestMock.request.mockResolvedValue({ body: desktopProfileResponse });

    const service = new AgentConfigService('ciUserId123', orgId, webexMock, wccAPIURL);
    const result = await service.getDesktopProfileById(desktopProfileId);

    expect(requestMock.request).toHaveBeenCalledWith(
      `${wccAPIURL}organization/${orgId}/agent-profile/${desktopProfileId}`,
      HTTP_METHODS.GET
    );
    expect(result).toEqual(desktopProfileResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('retrieveDesktopProfileById api called successfully.');
  });

  it('should handle error in getDesktopProfileById', async () => {
    const orgId = 'orgId123';
    const desktopProfileId = 'profileId123';

    requestMock.request.mockRejectedValue(new Error('Test Error'));

    const service = new AgentConfigService('ciUserId123', orgId, webexMock, wccAPIURL);

    await expect(service.getDesktopProfileById(desktopProfileId)).rejects.toThrow('Error while calling retrieveDesktopProfileById API, Error: Test Error');
  });

  it('should get list of teams successfully', async () => {
    const orgId = 'orgId123';
    const page = 1;
    const pageSize = 10;
    const filter = ['team1', 'team2'];
    const attributes = ['id', 'name'];
    const listTeamsResponse = { data: ['team1', 'team2'] };

    requestMock.request.mockResolvedValue({ body: listTeamsResponse });

    const service = new AgentConfigService('ciUserId123', orgId, webexMock, wccAPIURL);
    const result = await service.getListOfTeams(page, pageSize, filter, attributes);

    expect(requestMock.request).toHaveBeenCalledWith(
      `${wccAPIURL}organization/${orgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
      HTTP_METHODS.GET
    );
    expect(result).toEqual(listTeamsResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('getListOfTeams api called successfully.');
  });

  it('should handle error in getListOfTeams', async () => {
    const orgId = 'orgId123';
    const page = 1;
    const pageSize = 10;
    const filter = ['team1', 'team2'];
    const attributes = ['id', 'name'];

    requestMock.request.mockRejectedValue(new Error('Test Error'));

    const service = new AgentConfigService('ciUserId123', orgId, webexMock, wccAPIURL);

    await expect(service.getListOfTeams(page, pageSize, filter, attributes)).rejects.toThrow('Error while calling getListOfTeams API, Error: Test Error');
  });

  it('should get list of aux codes successfully', async () => {
    const orgId = 'orgId123';
    const page = 1;
    const pageSize = 10;
    const filter = ['code1', 'code2'];
    const attributes = ['id', 'name'];
    const listAuxCodesResponse = { data: [
      { id: 'code1', active: true, defaultCode: false, isSystemCode: false, description: 'desc1', name: 'name1', workTypeCode: 'WRAP_UP_CODE' },
      { id: 'code2', active: true, defaultCode: false, isSystemCode: false, description: 'desc2', name: 'name2', workTypeCode: 'IDLE_CODE' },
    ] };

    requestMock.request.mockResolvedValue({ body: listAuxCodesResponse });

    const service = new AgentConfigService('ciUserId123', orgId, webexMock, wccAPIURL);
    const result = await service.getListOfAuxCodes(page, pageSize, filter, attributes);

    expect(requestMock.request).toHaveBeenCalledWith(
      `${wccAPIURL}organization/${orgId}/team?page=${page}&pageSize=${pageSize}&filter=id=in=${filter}&attributes=${attributes}`,
      HTTP_METHODS.GET
    );
    expect(result).toEqual(listAuxCodesResponse);
    expect(webexMock.logger.log).toHaveBeenCalledWith('getListOfAuxCodes api called successfully.');
  });

  it('should handle error in getListOfAuxCodes', async () => {
    const orgId = 'orgId123';
    const page = 1;
    const pageSize = 10;
    const filter = ['code1', 'code2'];
    const attributes = ['id', 'name'];

    requestMock.request.mockRejectedValue(new Error('Test Error'));

    const service = new AgentConfigService('ciUserId123', orgId, webexMock, wccAPIURL);

    await expect(service.getListOfAuxCodes(page, pageSize, filter, attributes)).rejects.toThrow('Error while calling getListOfAuxCodes API, Error: Test Error');
  });
});
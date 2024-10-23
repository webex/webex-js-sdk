
import {expect} from 'chai';
import sinon from 'sinon';
import AgentConfigService from '../../../../src/AgentConfigService/AgentConfigService';
import HttpRequest from '../../../../src/HttpRequest';
import {WebexSDK, HTTP_METHODS} from '../../../../src/types';
import {
AgentResponse,
DesktopProfileResponse,
ListAuxCodesResponse,
ListTeamsResponse,
} from '../../../../src/AgentConfigService/types';

describe('AgentConfigService', () => {
let agentConfigService: AgentConfigService;
let requestInstanceStub: sinon.SinonStubbedInstance<HttpRequest>;
const agentId = 'test-agent-id';
const orgId = 'test-org-id';
const wccAPIURL = 'https://api.example.com/';
const webex = {
  logger: {
    log: sinon.stub(),
  },
} as unknown as WebexSDK;

beforeEach(() => {
  requestInstanceStub = sinon.createStubInstance(HttpRequest);
  agentConfigService = new AgentConfigService(agentId, orgId, webex, wccAPIURL);
  agentConfigService.requestInstance = requestInstanceStub;
});

describe('getUserUsingCI', () => {
  it('should return agent response on success', async () => {
    const expectedResponse: AgentResponse = {
      firstName: 'John',
      lastName: 'Doe',
      agentProfileId: 'profile-id',
      email: 'john.doe@example.com',
      teamIds: ['team1', 'team2'],
    };
    requestInstanceStub.request.resolves({statusCode: 200, body: expectedResponse});

    const response = await agentConfigService.getUserUsingCI();

    expect(response).to.deep.equal(expectedResponse);
    expect(webex.logger.log.calledWith('getUserUsingCI api success.')).to.be.true;
  });

  it('should throw an error if API call fails', async () => {
    requestInstanceStub.request.resolves({statusCode: 500, body: {}});

    try {
      await agentConfigService.getUserUsingCI();
    } catch (error) {
      expect(error.message).to.include('getUserUsingCI api failed');
    }
  });

  it('should throw an error if request throws an exception', async () => {
    requestInstanceStub.request.rejects(new Error('Network error'));

    try {
      await agentConfigService.getUserUsingCI();
    } catch (error) {
      expect(error.message).to.include('getUserUsingCI api failed');
    }
  });
});

describe('getDesktopProfileById', () => {
  const desktopProfileId = 'desktop-profile-id';

  it('should return desktop profile response on success', async () => {
    const expectedResponse: DesktopProfileResponse = {
      loginVoiceOptions: ['option1', 'option2'],
      accessWrapUpCode: 'ALL',
      accessIdleCode: 'SPECIFIC',
      wrapUpCodes: ['code1', 'code2'],
      idleCodes: ['code3', 'code4'],
    };
    requestInstanceStub.request.resolves({statusCode: 200, body: expectedResponse});

    const response = await agentConfigService.getDesktopProfileById(desktopProfileId);

    expect(response).to.deep.equal(expectedResponse);
    expect(webex.logger.log.calledWith('getDesktopProfileById api success.')).to.be.true;
  });

  it('should throw an error if API call fails', async () => {
    requestInstanceStub.request.resolves({statusCode: 500, body: {}});

    try {
      await agentConfigService.getDesktopProfileById(desktopProfileId);
    } catch (error) {
      expect(error.message).to.include('getDesktopProfileById api failed');
    }
  });

  it('should throw an error if request throws an exception', async () => {
    requestInstanceStub.request.rejects(new Error('Network error'));

    try {
      await agentConfigService.getDesktopProfileById(desktopProfileId);
    } catch (error) {
      expect(error.message).to.include('getDesktopProfileById api failed');
    }
  });
});

describe('getListOfTeams', () => {
  const page = 0;
  const pageSize = 10;
  const filter: string[] = [];
  const attributes: string[] = ['id'];

  it('should return list of teams response on success', async () => {
    const expectedResponse: ListTeamsResponse[] = [
      {id: 'team1', name: 'Team 1'},
      {id: 'team2', name: 'Team 2'},
    ];
    requestInstanceStub.request.resolves({statusCode: 200, body: expectedResponse});

    const response = await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);

    expect(response).to.deep.equal(expectedResponse);
    expect(webex.logger.log.calledWith('getListOfTeams api success.')).to.be.true;
  });

  it('should throw an error if API call fails', async () => {
    requestInstanceStub.request.resolves({statusCode: 500, body: {}});

    try {
      await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);
    } catch (error) {
      expect(error.message).to.include('getListOfTeams api failed');
    }
  });

  it('should throw an error if request throws an exception', async () => {
    requestInstanceStub.request.rejects(new Error('Network error'));

    try {
      await agentConfigService.getListOfTeams(page, pageSize, filter, attributes);
    } catch (error) {
      expect(error.message).to.include('getListOfTeams api failed');
    }
  });
});

describe('getListOfAuxCodes', () => {
  const page = 0;
  const pageSize = 10;
  const filter: string[] = [];
  const attributes: string[] = ['id'];

  it('should return list of aux codes response on success', async () => {
    const expectedResponse: ListAuxCodesResponse = {
      data: [
        {id: 'aux1', active: true, defaultCode: false, isSystemCode: false, description: 'desc1', name: 'Aux 1', workTypeCode: 'type1'},
        {id: 'aux2', active: false, defaultCode: true, isSystemCode: true, description: 'desc2', name: 'Aux 2', workTypeCode: 'type2'},
      ],
    };
    requestInstanceStub.request.resolves({statusCode: 200, body: expectedResponse});

    const response = await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);

    expect(response).to.deep.equal(expectedResponse);
    expect(webex.logger.log.calledWith('getListOfAuxCodes api success.')).to.be.true;
  });

  it('should throw an error if API call fails', async () => {
    requestInstanceStub.request.resolves({statusCode: 500, body: {}});

    try {
      await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);
    } catch (error) {
      expect(error.message).to.include('getListOfAuxCodes api failed');
    }
  });

  it('should throw an error if request throws an exception', async () => {
    requestInstanceStub.request.rejects(new Error('Network error'));

    try {
      await agentConfigService.getListOfAuxCodes(page, pageSize, filter, attributes);
    } catch (error) {
      expect(error.message).to.include('getListOfAuxCodes api failed');
    }
  });
});
});
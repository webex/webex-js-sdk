import {WebexSDK} from '../../../../../src/types';
import AgentConfigService from '../../../../../src/services/config';
import WebexRequest from '../../../../../src/services/core/WebexRequest';
import {WCC_API_GATEWAY} from '../../../../../src/services/constants';
import {CONFIG_FILE_NAME} from '../../../../../src/constants';
import MockWebex from '@webex/test-helper-mock-webex';
import LoggerProxy from '../../../../../src/logger-proxy';
import * as util from '../../../../../src/services/config/Util';
import {DEFAULT_AUXCODE_ATTRIBUTES} from '../../../../../src/services/config/constants';
import {normalizeRecoveryFailure} from '../../../../../src/services/core/Utils';
import {createDeferred, flushMicrotasks} from '../../../fixtures/aiSummaryTestUtils';

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

  describe('T-001 authoritative MR reader', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      [{id: 'org-sanitized', licenseVersion: '4.0', multiRegionEnabled: true, homeRegion: ' US1 '}, {eligibility: 'enabled', homeRegion: 'us1'}],
      [{id: 'org-sanitized', licenseVersion: '4.0'}, {eligibility: 'disabled'}],
    ])('reads the Webex array-body contract fixture %# (constructed, not deployed evidence)', async (record, expected) => {
      (mockWebexRequest.request as jest.Mock).mockResolvedValue({statusCode: 200, body: [record]});
      await expect(agentConfigService.getMultiRegionSettings('org/escaped')).resolves.toEqual(expected);
      expect(mockWebexRequest.request).toHaveBeenCalledWith({service: WCC_API_GATEWAY, method: 'GET', resource: 'organization/org%2Fescaped/organization-setting', timeout: 10000});
    });

    it('times out an unanswered settings GET and ignores its late completion', async () => {
      jest.useFakeTimers();
      try {
        const pending = createDeferred<any>();
        (mockWebexRequest.request as jest.Mock).mockReturnValueOnce(pending.promise);
        const received = jest.fn();
        const result = agentConfigService.getMultiRegionSettings(mockOrgId).then(received, received);

        jest.advanceTimersByTime(9999);
        await flushMicrotasks();
        expect(received).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await result;
        expect(received).toHaveBeenCalledWith(new Error('Organization settings request timed out'));

        pending.resolve({statusCode: 200, body: [{multiRegionEnabled: true}]});
        await flushMicrotasks();
        expect(received).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it.each([
      {description: 'an empty array', body: []},
      {description: 'a nested data envelope', body: {data: [{multiRegionEnabled: true}]}},
      {description: 'an empty first record', body: [{}]},
      {description: 'an empty first record before a valid record', body: [{}, {multiRegionEnabled: true}]},
      {description: 'a null first record before a valid record', body: [null, {multiRegionEnabled: true}]},
      {description: 'an array first record before a valid record', body: [[], {multiRegionEnabled: true}]},
      {description: 'a primitive first record before a valid record', body: ['invalid', {multiRegionEnabled: true}]},
      {description: 'an undefined MR flag', body: [{multiRegionEnabled: undefined}]},
      {description: 'a null MR flag', body: [{multiRegionEnabled: null}]},
      {description: 'a string MR flag', body: [{multiRegionEnabled: 'true'}]},
      {description: 'a numeric MR flag', body: [{multiRegionEnabled: 1}]},
    ])('rejects HTTP 200 with $description', async ({body}) => {
      (mockWebexRequest.request as jest.Mock).mockResolvedValue({statusCode: 200, body});

      await expect(agentConfigService.getMultiRegionSettings(mockOrgId)).rejects.toMatchObject({
        data: {reason: 'INVALID_MR_SETTINGS'},
      });
      expect(mockWebexRequest.request).toHaveBeenCalledTimes(1);
    });

    it.each([401, 403, 408, 429, 500, 502, 503, 599, 400, 404, 302].flatMap(status =>
      ['SAFE_REASON', 'INVALID_ORG_ID', 'INVALID_MR_SETTINGS', 'RECOVERY_INTERRUPTED'].map(reason => ({status, reason}))
    ))('retains structured returned status $status and backend reason $reason without local provenance', async ({status, reason}) => {
      (mockWebexRequest.request as jest.Mock).mockResolvedValue({statusCode: status, headers: {TrackingID: 'request-id'}, body: {reason, reasonCode: '1037'}});
      const result = await agentConfigService.getMultiRegionSettings(mockOrgId).catch((error) => error);
      expect(result[util.LOCAL_MR_SETTINGS_ERROR]).toBeUndefined();
      expect(normalizeRecoveryFailure(result)).toEqual({status, reason, reasonCode: 1037, trackingId: 'request-id'});
    });

    it.each([0, 503].flatMap(status =>
      ['INTERNAL_ERROR', 'INVALID_ORG_ID', 'INVALID_MR_SETTINGS', 'RECOVERY_INTERRUPTED'].map(reason => ({status, reason}))
    ))('retains the original rejected Webex error with non-enumerable statusCode $status and reason $reason', async ({status, reason}) => {
      const error = Object.defineProperties(new Error('request failed'), {
        name: {value: status === 0 ? 'NetworkOrCORSError' : 'ServiceUnavailable'},
        statusCode: {value: status},
        body: {value: status === 0 ? new Error('Network request failed') : {reason}},
        headers: {value: {trackingid: 'request-id'}},
      });
      (mockWebexRequest.request as jest.Mock).mockRejectedValue(error);
      await expect(agentConfigService.getMultiRegionSettings(mockOrgId)).rejects.toBe(error);
      expect(error[util.LOCAL_MR_SETTINGS_ERROR]).toBeUndefined();
      expect(normalizeRecoveryFailure(error)).toEqual({status, ...(status === 503 ? {reason} : {}), trackingId: 'request-id'});
    });

    it.each(['', '   '])('rejects blank orgId before dispatch %#', async (orgId) => {
      const error = await agentConfigService.getMultiRegionSettings(orgId).catch(error => error);
      expect(error[util.LOCAL_MR_SETTINGS_ERROR]).toBe('INVALID_ORG_ID');
      expect(normalizeRecoveryFailure(error)).toEqual({reason: 'INVALID_ORG_ID'});
      expect(mockWebexRequest.request).not.toHaveBeenCalled();
    });

    it.each(['resolve', 'reject'])('removes the registered abort callback after normal HTTP %s', async (settle) => {
      const controller = new AbortController();
      const addListener = jest.spyOn(controller.signal, 'addEventListener');
      const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
      const response = {statusCode: 200, body: [{multiRegionEnabled: true}]};
      const pending = createDeferred<typeof response>();
      const error = new Error('request failed');
      (mockWebexRequest.request as jest.Mock).mockReturnValue(pending.promise);

      const result = agentConfigService.getMultiRegionSettings(mockOrgId, controller.signal);
      expect(addListener.mock.calls).toEqual([['abort', expect.any(Function), {once: true}]]);
      const onAbort = addListener.mock.calls[0][1];
      expect(removeListener).not.toHaveBeenCalled();
      const settled = settle === 'resolve'
        ? expect(result).resolves.toEqual({eligibility: 'enabled'})
        : expect(result).rejects.toBe(error);

      if (settle === 'resolve') pending.resolve(response);
      else pending.reject(error);
      await settled;

      expect(controller.signal.aborted).toBe(false);
      expect(removeListener.mock.calls).toEqual([['abort', onAbort]]);
    });

    it('rejects an abort after HTTP settlement removes the listener but before the reader resumes', async () => {
      const controller = new AbortController();
      const addListener = jest.spyOn(controller.signal, 'addEventListener');
      const detach = controller.signal.removeEventListener.bind(controller.signal);
      const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
      const response = {statusCode: 200, body: [{multiRegionEnabled: true}]};
      const pending = createDeferred<typeof response>();
      (mockWebexRequest.request as jest.Mock).mockReturnValue(pending.promise);

      const result = agentConfigService.getMultiRegionSettings(mockOrgId, controller.signal);
      const rejected = expect(result).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      expect(addListener.mock.calls).toEqual([['abort', expect.any(Function), {once: true}]]);
      const onAbort = addListener.mock.calls[0][1];
      expect(removeListener).not.toHaveBeenCalled();

      const detached = createDeferred<void>();
      removeListener.mockImplementationOnce((type, listener, options) => {
        detach(type, listener, options);
        detached.resolve(undefined);
      });
      pending.resolve(response);
      await detached.promise;
      expect(controller.signal.aborted).toBe(false);
      expect(removeListener.mock.calls).toEqual([['abort', onAbort]]);
      controller.abort();

      await rejected;
      // The detached pending-request handler cannot be responsible for the rejection.
      expect(removeListener.mock.calls).toEqual([['abort', onAbort]]);
    });

    it.each(['resolve', 'reject'])('cancels local ownership and observes late HTTP %s', async (settle) => {
      const controller = new AbortController();
      const pending = createDeferred<any>();
      (mockWebexRequest.request as jest.Mock).mockReturnValue(pending.promise);
      const result = agentConfigService.getMultiRegionSettings(mockOrgId, controller.signal);
      const rejected = expect(result).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      controller.abort();
      await rejected;
      if (settle === 'resolve') pending.resolve({statusCode: 200, body: [{multiRegionEnabled: true}]});
      else pending.reject(new Error('late failure'));
      await flushMicrotasks();
      expect(mockWebexRequest.request).toHaveBeenCalledTimes(1);
      await expect(agentConfigService.getMultiRegionSettings(mockOrgId, controller.signal)).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      expect(mockWebexRequest.request).toHaveBeenCalledTimes(1);
    });
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

    it.each([true, false])('T-001 profileAggregateDependencyOrder dialPlan=%s', async (dialPlanEnabled) => {
      stubConfigCalls({agentProfile: {...mockAgentProfile, dialPlanEnabled}});
      const user = createDeferred<any>();
      const org = createDeferred<any>();
      const aux = createDeferred<any>();
      (agentConfigService.getUserDesktopLoginConfig as jest.Mock).mockReturnValue(user.promise);
      (agentConfigService.getOrgDesktopLoginConfig as jest.Mock).mockReturnValue(org.promise);
      (agentConfigService.getAllAuxCodes as jest.Mock).mockReturnValue(aux.promise);
      const result = agentConfigService.getAgentConfig(mockOrgId, mockAgentId);
      const settled = jest.fn();
      const observed = result.then(settled);
      expect(agentConfigService.getOrgDesktopLoginConfig).toHaveBeenCalledTimes(1);
      expect(agentConfigService.getUserDesktopLoginConfig).toHaveBeenCalledTimes(1);
      expect(agentConfigService.getAllAuxCodes).toHaveBeenCalledTimes(1);
      expect(agentConfigService.getSiteInfo).not.toHaveBeenCalled();
      expect(agentConfigService.getAllTeams).not.toHaveBeenCalled();
      expect(agentConfigService.getDialPlanData).not.toHaveBeenCalled();
      user.resolve({user: mockUser, agentProfile: {...mockAgentProfile, dialPlanEnabled}});
      await flushMicrotasks();
      expect(agentConfigService.getSiteInfo).toHaveBeenCalledTimes(1);
      expect(agentConfigService.getAllTeams).toHaveBeenCalledTimes(1);
      expect(agentConfigService.getDialPlanData).toHaveBeenCalledTimes(dialPlanEnabled ? 1 : 0);
      expect(settled).not.toHaveBeenCalled();
      org.resolve(mockOrgConfig);
      aux.resolve(mockAuxCodes);
      await observed;
      expect(settled).toHaveBeenCalledTimes(1);
    });

    it('T-001 profileUserFailureWithFulfilledIndependentReads', async () => {
      stubConfigCalls();
      const user = createDeferred<any>();
      (agentConfigService.getUserDesktopLoginConfig as jest.Mock).mockReturnValue(user.promise);
      const failure = new Error('user read failed');
      const result = expect(agentConfigService.getAgentConfig(mockOrgId, mockAgentId)).rejects.toBe(failure);
      user.reject(failure);
      await result;
      expect(agentConfigService.getSiteInfo).not.toHaveBeenCalled();
      expect(agentConfigService.getAllTeams).not.toHaveBeenCalled();
    });

    it.each(['getOrgDesktopLoginConfig', 'getAllAuxCodes', 'getSiteInfo', 'getAllTeams', 'getDialPlanData'])(
      'T-001 profileObservedAggregateFailures %s', async (method) => {
        stubConfigCalls({agentProfile: {...mockAgentProfile, dialPlanEnabled: true}});
        const pending = createDeferred<any>();
        (agentConfigService[method] as jest.Mock).mockReturnValue(pending.promise);
        const failure = new Error('observed aggregate read failed');
        const result = expect(agentConfigService.getAgentConfig(mockOrgId, mockAgentId)).rejects.toBe(failure);
        await flushMicrotasks();
        pending.reject(failure);
        await result;
      }
    );

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

import {expect} from '@jest/globals';
import UserPreference, {readSavedStationLogin} from '../../../../src/services/UserPreference';
import {HTTP_METHODS, LoginOption, WebexSDK, IHttpResponse} from '../../../../src/types';
import type {Profile} from '../../../../src/services/config/types';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';
import {createDeferred, flushMicrotasks} from '../../fixtures/aiSummaryTestUtils';

jest.mock('../../../../src/metrics/MetricsManager');
jest.mock('../../../../src/logger-proxy');

describe('UserPreference', () => {
  let userPreferenceAPI: UserPreference;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;

  const mockGetUserId = jest.fn().mockReturnValue('test-user-id');

  beforeEach(() => {
    jest.clearAllMocks();
    (WebexRequest as any).instance = undefined;

    mockWebex = {
      credentials: {
        getOrgId: jest.fn().mockReturnValue('test-org-id'),
      },
      request: jest.fn(),
      internal: {
        newMetrics: {
          submitBehavioralEvent: jest.fn(),
          submitOperationalEvent: jest.fn(),
          submitBusinessEvent: jest.fn(),
        },
      },
      ready: true,
      once: jest.fn(),
    } as unknown as WebexSDK;

    mockMetricsManager = {
      trackEvent: jest.fn(),
      timeEvent: jest.fn(),
    } as unknown as jest.Mocked<MetricsManager>;
    (MetricsManager.getInstance as jest.Mock).mockReturnValue(mockMetricsManager);

    userPreferenceAPI = new UserPreference(mockWebex, mockGetUserId);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance({webex: mockWebex})).toBeDefined();
      expect(MetricsManager.getInstance).toHaveBeenCalledWith({webex: mockWebex});
    });
  });

  describe('readSavedStationLogin', () => {
    const team = {id: 'resource-team', dbId: 'routing-team', active: true} as Profile['teams'][number];
    const defaultProfile = {
      agentId: 'test-user-id',
      teams: [team],
      loginVoiceOptions: [LoginOption.AGENT_DN, LoginOption.EXTENSION],
      dialPlan: {dialPlanEntity: [{regex: '^\\+1\\d{10}$', strippedChars: ''}]},
    } as Profile;
    const preference = {
      selectedRoleName: 'agent',
      teamId: 'routing-team',
      deviceType: LoginOption.AGENT_DN,
      dialNumber: ' +1 800 555 0123 ',
      dontShowAgain: true,
    };
    const respond = (
      saved: Record<string, unknown> = preference,
      fields: Record<string, unknown> = {}
    ) =>
      ({
        statusCode: 200,
        body: {
          id: defaultProfile.agentId,
          desktopPreference: JSON.stringify(saved),
          ...fields,
        },
      }) as IHttpResponse;
    const read = (
      profile = defaultProfile,
      signal = new AbortController().signal,
      orgId = 'test-org-id'
    ) => readSavedStationLogin(WebexRequest.getInstance({webex: mockWebex}), orgId, profile, signal);

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('reads the current CI user and returns a normalized opted-in DN for the Routing team', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(respond());

      await expect(read()).resolves.toEqual({
        loginOption: LoginOption.AGENT_DN,
        teamId: 'routing-team',
        dialNumber: '+18005550123',
      });
      expect(mockWebex.request).toHaveBeenCalledTimes(1);
      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.GET,
        headers: {'X-ORGANIZATION-ID': 'test-org-id'},
        timeout: 10000,
        body: undefined,
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('uses the resource ID when there is no Routing ID and accepts a matching saved extension', async () => {
      const profile = {
        ...defaultProfile,
        teams: [{...team, dbId: undefined}],
        defaultDn: '1234',
        forceDefaultDnForAgent: true,
      };
      (mockWebex.request as jest.Mock).mockResolvedValue(
        respond(
          {
            ...preference,
            deviceType: LoginOption.EXTENSION,
            teamId: team.id,
            dialNumber: ' 12 34 ',
            extensionNumber: '1234',
          },
          {organizationId: 'test-org-id', userId: defaultProfile.agentId}
        )
      );

      await expect(read(profile)).resolves.toEqual({
        loginOption: LoginOption.EXTENSION,
        teamId: team.id,
        dialNumber: '1234',
      });
    });

    it.each([
      ['other organization', {organizationId: 'other-org'}],
      ['other user', {userId: 'other-user'}],
      ['other CI identity', {id: 'other-user'}],
      ['missing CI identity', {id: undefined}],
      ['malformed JSON', {desktopPreference: '{"private-number"'}],
      ['non-object JSON', {desktopPreference: '[]'}],
      ['unrecognized shape', {desktopPreference: undefined, preferences: preference}],
    ])('ignores %s preference data', async (_condition, fields) => {
      (mockWebex.request as jest.Mock).mockResolvedValue(respond(preference, fields));

      await expect(read()).resolves.toBeUndefined();
      expect(LoggerProxy.error).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each([
      ['no opt-in', {dontShowAgain: undefined, isRememberMyCredentials: true}],
      ['declined opt-in', {dontShowAgain: false}],
      ['invalid opt-in', {dontShowAgain: 'true'}],
      ['unsupported role', {selectedRoleName: 'agent_supervisor'}],
      ['browser voice', {deviceType: LoginOption.BROWSER}],
      ['unknown team', {teamId: 'another-team'}],
      ['resource ID instead of an available Routing ID', {teamId: 'resource-team'}],
      ['invalid DN', {dialNumber: '+1800;echo'}],
      ['DN outside the dial plan', {dialNumber: '+442079460123'}],
      ['invalid extension', {deviceType: LoginOption.EXTENSION, dialNumber: '+1234', extensionNumber: '+1234'}],
      ['inconsistent extension', {deviceType: LoginOption.EXTENSION, dialNumber: '1234', extensionNumber: '5678'}],
    ])('ignores a saved station with %s', async (_condition, fields) => {
      (mockWebex.request as jest.Mock).mockResolvedValue(respond({...preference, ...fields}));

      await expect(read()).resolves.toBeUndefined();
    });

    it.each([
      ['inactive team', {teams: [{...team, active: false}]}],
      ['disabled voice option', {loginVoiceOptions: [LoginOption.EXTENSION]}],
      ['tenant-forced default DN', {defaultDn: '+18005550124', forceDefaultDn: true}],
      ['agent-forced default DN', {defaultDn: '+18005550124', forceDefaultDnForAgent: true}],
    ])('honors the current profile when it has %s', async (_condition, fields) => {
      (mockWebex.request as jest.Mock).mockResolvedValue(respond());

      await expect(read({...defaultProfile, ...fields})).resolves.toBeUndefined();
    });

    it('skips I/O when cancelled or missing the current identity', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(read(defaultProfile, controller.signal)).resolves.toBeUndefined();
      await expect(read({...defaultProfile, agentId: ''})).resolves.toBeUndefined();
      await expect(read(defaultProfile, new AbortController().signal, '')).resolves.toBeUndefined();
      expect(mockWebex.request).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('returns no station when the gateway fails without logging raw errors', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValueOnce(new Error('private backend details'));
      (mockWebex.request as jest.Mock).mockResolvedValueOnce({...respond(), statusCode: 404});

      await expect(read()).resolves.toBeUndefined();
      await expect(read()).resolves.toBeUndefined();
      expect(LoggerProxy.error).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['abort', 'deadline'])('settles on %s while the host request is pending', async (boundary) => {
      const pending = createDeferred<IHttpResponse>();
      const controller = new AbortController();
      (mockWebex.request as jest.Mock).mockReturnValue(pending.promise);
      const result = read(defaultProfile, controller.signal);
      const settled = jest.fn();
      result.then(settled);

      if (boundary === 'abort') {
        controller.abort();
      } else {
        jest.advanceTimersByTime(9999);
        await flushMicrotasks();
        expect(jest.getTimerCount()).toBe(1);
        expect(settled).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
      }

      await expect(result).resolves.toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
      if (boundary === 'abort') pending.reject(new Error('private late error'));
      else pending.resolve(respond());
      await flushMicrotasks();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(LoggerProxy.error).not.toHaveBeenCalled();
    });
  });

  describe('getUserPreference', () => {
    const mockPreference = {
      id: 'pref-123',
      organizationId: 'test-org-id',
      userId: 'test-user-id',
      preferences: {e911Reminder: true},
      createdTime: 1234567890,
      lastUpdatedTime: 1234567890,
    };

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      method: 'GET',
      url: '/organization/test-org-id/user-preference/test-user-id',
      headers: {} as any,
      body: mockPreference,
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch user preferences successfully with default userId', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.getUserPreference();

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.GET,
        body: undefined,
      });
      expect(result).toEqual(mockPreference);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_SUCCESS
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_SUCCESS,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 200,
        }),
        ['behavioral', 'operational']
      );
    });

    it('should fetch user preferences for a specific userId', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.getUserPreference({userId: 'specific-user-id'});

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/specific-user-id',
        method: HTTP_METHODS.GET,
        body: undefined,
      });
      expect(result).toEqual(mockPreference);
    });

    it('should fetch user preferences with pagination parameters', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.getUserPreference({page: 1, pageSize: 50});

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id?page=1&pageSize=50',
        method: HTTP_METHODS.GET,
        body: undefined,
      });
      expect(result).toEqual(mockPreference);
    });

    it('should throw error when userId is not available', async () => {
      mockGetUserId.mockReturnValueOnce('');

      await expect(userPreferenceAPI.getUserPreference()).rejects.toThrow(
        'UserPreference: userId is not available.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API call failed');
      (mockWebex.request as jest.Mock).mockRejectedValue(mockError);

      await expect(userPreferenceAPI.getUserPreference()).rejects.toThrow('API call failed');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_FAILED,
        expect.objectContaining({
          error: 'API call failed',
        }),
        ['behavioral', 'operational']
      );
    });
  });

  describe('createUserPreference', () => {
    const mockCreateRequest = {
      userId: 'test-user-id',
      desktopPreference: '{}',
    };

    const mockCreatedPreference = {
      id: 'pref-123',
      organizationId: 'test-org-id',
      userId: 'test-user-id',
      preferences: {e911Reminder: true},
      createdTime: 1234567890,
      lastUpdatedTime: 1234567890,
    };

    const mockResponse: IHttpResponse = {
      statusCode: 201,
      method: 'POST',
      url: '/organization/test-org-id/user-preference',
      headers: {} as any,
      body: mockCreatedPreference,
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create user preferences successfully', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.createUserPreference(mockCreateRequest);

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference',
        method: HTTP_METHODS.POST,
        body: mockCreateRequest,
      });
      expect(result).toEqual(mockCreatedPreference);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_SUCCESS
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_SUCCESS,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 201,
        }),
        ['behavioral', 'operational']
      );
    });

    it('should throw error when userId is missing in request', async () => {
      const invalidRequest = {
        userId: '',
        desktopPreference: '{}',
      };

      await expect(userPreferenceAPI.createUserPreference(invalidRequest)).rejects.toThrow(
        'UserPreference: userId is required to create user preferences.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API call failed');
      (mockWebex.request as jest.Mock).mockRejectedValue(mockError);

      await expect(userPreferenceAPI.createUserPreference(mockCreateRequest)).rejects.toThrow(
        'API call failed'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_FAILED,
        expect.objectContaining({
          error: 'API call failed',
        }),
        ['behavioral', 'operational']
      );
    });
  });

  describe('updateUserPreference', () => {
    const mockUpdateRequest = {
      desktopPreference: '{}',
    };

    const mockUpdatedPreference = {
      id: 'pref-123',
      organizationId: 'test-org-id',
      userId: 'test-user-id',
      preferences: {e911Reminder: false},
      createdTime: 1234567890,
      lastUpdatedTime: 1234567899,
    };

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      method: 'PUT',
      url: '/organization/test-org-id/user-preference/test-user-id',
      headers: {} as any,
      body: mockUpdatedPreference,
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should update user preferences successfully', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.updateUserPreference(
        'test-user-id',
        mockUpdateRequest
      );

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.PUT,
        body: mockUpdateRequest,
      });
      expect(result).toEqual(mockUpdatedPreference);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_SUCCESS
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_SUCCESS,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 200,
        }),
        ['behavioral', 'operational']
      );
    });

    it('should throw error when userId is missing', async () => {
      await expect(userPreferenceAPI.updateUserPreference('', mockUpdateRequest)).rejects.toThrow(
        'UserPreference: userId is required to update user preferences.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API call failed');
      (mockWebex.request as jest.Mock).mockRejectedValue(mockError);

      await expect(
        userPreferenceAPI.updateUserPreference('test-user-id', mockUpdateRequest)
      ).rejects.toThrow('API call failed');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_FAILED,
        expect.objectContaining({
          error: 'API call failed',
        }),
        ['behavioral', 'operational']
      );
    });
  });

  describe('deleteUserPreference', () => {
    const mockResponse: IHttpResponse = {
      statusCode: 204,
      method: 'DELETE',
      url: '/organization/test-org-id/user-preference/test-user-id',
      headers: {} as any,
      body: null,
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should delete user preferences successfully', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      await userPreferenceAPI.deleteUserPreference('test-user-id');

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.DELETE,
        body: undefined,
      });
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_SUCCESS
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_SUCCESS,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 204,
        }),
        ['behavioral', 'operational']
      );
    });

    it('should throw error when userId is missing', async () => {
      await expect(userPreferenceAPI.deleteUserPreference('')).rejects.toThrow(
        'UserPreference: userId is required to delete user preferences.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API call failed');
      (mockWebex.request as jest.Mock).mockRejectedValue(mockError);

      await expect(userPreferenceAPI.deleteUserPreference('test-user-id')).rejects.toThrow(
        'API call failed'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_FAILED,
        expect.objectContaining({
          error: 'API call failed',
        }),
        ['behavioral', 'operational']
      );
    });
  });
});

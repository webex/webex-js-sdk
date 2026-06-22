import {expect} from '@jest/globals';
import UserPreference from '../../../../src/services/UserPreference';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';

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

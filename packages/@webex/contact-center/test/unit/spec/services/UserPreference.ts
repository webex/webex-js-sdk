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
      desktopPreference: '{"theme": "dark"}',
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

    it('should fetch user preferences successfully with default userId', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.getUserPreference();

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_SUCCESS
      );
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_FAILED
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_SUCCESS,
        {
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 200,
        },
        ['behavioral', 'operational']
      );
    });

    it('should fetch user preferences with custom userId', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.getUserPreference({userId: 'custom-user-id'});

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/custom-user-id',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
    });

    it('should fetch user preferences with pagination parameters', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await userPreferenceAPI.getUserPreference({page: 1, pageSize: 50});

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id?page=1&pageSize=50',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
    });

    it('should throw error when userId is not available', async () => {
      mockGetUserId.mockReturnValueOnce('');

      await expect(userPreferenceAPI.getUserPreference()).rejects.toThrow(
        'UserPreference: userId is not available.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors and track failure metrics', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Internal Server Error'));

      await expect(userPreferenceAPI.getUserPreference()).rejects.toThrow('Internal Server Error');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_FAILED,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          error: 'Internal Server Error',
        }),
        ['behavioral', 'operational']
      );

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'Failed to fetch user preferences',
        expect.objectContaining({
          module: 'UserPreference',
          method: 'getUserPreference',
        })
      );
    });
  });

  describe('createUserPreference', () => {
    const mockCreatedPreference = {
      id: 'pref-123',
      organizationId: 'test-org-id',
      userId: 'test-user-id',
      desktopPreference: '{"theme": "dark"}',
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

    it('should create user preferences successfully', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const requestData = {
        userId: 'test-user-id',
        desktopPreference: '{"theme": "dark"}',
      };

      const result = await userPreferenceAPI.createUserPreference(requestData);

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference',
        method: HTTP_METHODS.POST,
        body: requestData,
      });

      expect(result).toEqual(mockResponse.body);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_SUCCESS
      );
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_FAILED
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_SUCCESS,
        {
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 201,
        },
        ['behavioral', 'operational']
      );
    });

    it('should throw error when userId is not provided', async () => {
      const requestData = {
        userId: '',
        desktopPreference: '{"theme": "dark"}',
      };

      await expect(userPreferenceAPI.createUserPreference(requestData)).rejects.toThrow(
        'UserPreference: userId is required to create user preferences.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors and track failure metrics', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Bad Request'));

      const requestData = {
        userId: 'test-user-id',
        desktopPreference: '{"theme": "dark"}',
      };

      await expect(userPreferenceAPI.createUserPreference(requestData)).rejects.toThrow(
        'Bad Request'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_FAILED,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          error: 'Bad Request',
        }),
        ['behavioral', 'operational']
      );
    });
  });

  describe('updateUserPreference', () => {
    const mockUpdatedPreference = {
      id: 'pref-123',
      organizationId: 'test-org-id',
      userId: 'test-user-id',
      desktopPreference: '{"theme": "light"}',
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

    it('should update user preferences successfully', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const requestData = {
        desktopPreference: '{"theme": "light"}',
      };

      const result = await userPreferenceAPI.updateUserPreference('test-user-id', requestData);

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.PUT,
        body: requestData,
      });

      expect(result).toEqual(mockResponse.body);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_SUCCESS
      );
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_FAILED
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_SUCCESS,
        {
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 200,
        },
        ['behavioral', 'operational']
      );
    });

    it('should throw error when userId is not provided', async () => {
      const requestData = {
        desktopPreference: '{"theme": "light"}',
      };

      await expect(userPreferenceAPI.updateUserPreference('', requestData)).rejects.toThrow(
        'UserPreference: userId is required to update user preferences.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors and track failure metrics', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Not Found'));

      const requestData = {
        desktopPreference: '{"theme": "light"}',
      };

      await expect(
        userPreferenceAPI.updateUserPreference('test-user-id', requestData)
      ).rejects.toThrow('Not Found');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_FAILED,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          error: 'Not Found',
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
      body: undefined,
    };

    it('should delete user preferences successfully', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      await userPreferenceAPI.deleteUserPreference('test-user-id');

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: 'organization/test-org-id/user-preference/test-user-id',
        method: HTTP_METHODS.DELETE,
      });

      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_SUCCESS
      );
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_FAILED
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_SUCCESS,
        {
          orgId: 'test-org-id',
          userId: 'test-user-id',
          statusCode: 204,
        },
        ['behavioral', 'operational']
      );
    });

    it('should throw error when userId is not provided', async () => {
      await expect(userPreferenceAPI.deleteUserPreference('')).rejects.toThrow(
        'UserPreference: userId is required to delete user preferences.'
      );

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle API errors and track failure metrics', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Forbidden'));

      await expect(userPreferenceAPI.deleteUserPreference('test-user-id')).rejects.toThrow(
        'Forbidden'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_FAILED,
        expect.objectContaining({
          orgId: 'test-org-id',
          userId: 'test-user-id',
          error: 'Forbidden',
        }),
        ['behavioral', 'operational']
      );
    });
  });
});

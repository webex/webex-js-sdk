import {HTTP_METHODS, WebexSDK} from '../types';
import type {
  UserPreference as UserPreferenceResponse,
  CreateUserPreferenceRequest,
  UpdateUserPreferenceRequest,
  GetUserPreferenceParams,
} from './config/types';
import LoggerProxy from '../logger-proxy';
import WebexRequest from './core/WebexRequest';
import MetricsManager from '../metrics/MetricsManager';
import {WCC_API_GATEWAY} from './constants';
import {endPointMap} from './config/constants';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

/**
 * UserPreference API class for managing Webex Contact Center user preferences.
 * Provides functionality to get, create, update, and delete user preferences.
 *
 * @class UserPreference
 * @public
 * @example
 * ```typescript
 * import Webex from 'webex';
 *
 * const webex = new Webex({ credentials: 'YOUR_ACCESS_TOKEN' });
 * const cc = webex.cc;
 *
 * // Register and login first
 * await cc.register();
 * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
 *
 * // Get UserPreference API instance from ContactCenter
 * const userPreferenceAPI = cc.userPreference;
 *
 * // Get user preferences for the current user
 * const preferences = await userPreferenceAPI.getUserPreference();
 *
 * // Create new user preferences
 * const newPreferences = await userPreferenceAPI.createUserPreference({
 *   userId: 'user123',
 *   preferences: { e911Reminder: true }
 * });
 *
 * // Update user preferences
 * const updatedPreferences = await userPreferenceAPI.updateUserPreference('user123', {
 *   preferences: { e911Reminder: false }
 * });
 *
 * // Delete user preferences
 * await userPreferenceAPI.deleteUserPreference('user123');
 * ```
 */
export class UserPreference {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;
  private getUserId: () => string;
  private metricsManager: MetricsManager;

  /**
   * Creates an instance of UserPreference
   * @param {WebexSDK} webex - The Webex SDK instance
   * @param {() => string} getUserId - Function to get the current user's CI user ID
   * @public
   */
  constructor(webex: WebexSDK, getUserId: () => string) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.getUserId = getUserId;
    this.metricsManager = MetricsManager.getInstance({webex});
  }

  /**
   * Fetches user preferences for a specific user
   * @param {GetUserPreferenceParams} [params] - Optional parameters for fetching preferences
   * @param {string} [params.userId] - User ID to fetch preferences for. Defaults to current user's CI user ID.
   * @param {number} [params.page=0] - Page number (0-indexed). Default: 0
   * @param {number} [params.pageSize=100] - Number of items per page. Default: 100
   * @returns {Promise<UserPreferenceResponse>} Promise resolving to user preferences
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Get preferences for current user
   * const preferences = await userPreferenceAPI.getUserPreference();
   *
   * // Get preferences for a specific user
   * const preferences = await userPreferenceAPI.getUserPreference({ userId: 'user123' });
   *
   * // Get preferences with pagination
   * const preferences = await userPreferenceAPI.getUserPreference({ page: 0, pageSize: 50 });
   * ```
   */
  public async getUserPreference(
    params?: GetUserPreferenceParams
  ): Promise<UserPreferenceResponse> {
    const {userId, page, pageSize} = params || {};
    const targetUserId = userId || this.getUserId();
    const orgId = this.webex.credentials.getOrgId();

    LoggerProxy.info('Fetching user preferences', {
      module: 'UserPreference',
      method: 'getUserPreference',
      data: {
        orgId,
        userId: targetUserId,
        page,
        pageSize,
      },
    });

    if (!targetUserId) {
      LoggerProxy.error('getUserPreference called without a valid userId', {
        module: 'UserPreference',
        method: 'getUserPreference',
        data: {
          orgId,
          userId: targetUserId,
          error: 'Missing userId. Ensure user is logged in or provide a userId.',
        },
      });

      throw new Error('UserPreference: userId is not available.');
    }

    try {
      let resource = endPointMap.userPreference(orgId, targetUserId);

      // Build query parameters if provided
      const queryParams: string[] = [];
      if (page !== undefined) queryParams.push(`page=${page}`);
      if (pageSize !== undefined) queryParams.push(`pageSize=${pageSize}`);
      if (queryParams.length > 0) {
        resource = `${resource}?${queryParams.join('&')}`;
      }

      LoggerProxy.info('Making API request to fetch user preferences', {
        module: 'UserPreference',
        method: 'getUserPreference',
        data: {
          resource,
          service: WCC_API_GATEWAY,
        },
      });

      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_GET_SUCCESS);
      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_GET_FAILED);

      const response = await this.webexRequest.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      LoggerProxy.info('Successfully retrieved user preferences', {
        module: 'UserPreference',
        method: 'getUserPreference',
        data: {
          statusCode: response.statusCode,
          userId: targetUserId,
        },
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.USER_PREFERENCE_GET_SUCCESS,
        {
          orgId,
          userId: targetUserId,
          statusCode: response.statusCode,
        },
        ['behavioral', 'operational']
      );

      return response.body;
    } catch (error) {
      const errorData = {
        orgId,
        userId: targetUserId,
        error: error instanceof Error ? error.message : String(error),
      };

      LoggerProxy.error('Failed to fetch user preferences', {
        module: 'UserPreference',
        method: 'getUserPreference',
        data: errorData,
        error,
      });

      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_GET_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw error;
    }
  }

  /**
   * Creates new user preferences
   * @param {CreateUserPreferenceRequest} data - The user preference data to create
   * @returns {Promise<UserPreference>} Promise resolving to created user preferences
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * const newPreferences = await userPreferenceAPI.createUserPreference({
   *   userId: 'user123',
   *   preferences: { e911Reminder: true, notificationSettings: { email: true } }
   * });
   * ```
   */
  public async createUserPreference(
    data: CreateUserPreferenceRequest
  ): Promise<UserPreferenceResponse> {
    const orgId = this.webex.credentials.getOrgId();

    LoggerProxy.info('Creating user preferences', {
      module: 'UserPreference',
      method: 'createUserPreference',
      data: {
        orgId,
        userId: data.userId,
      },
    });

    if (!data.userId) {
      LoggerProxy.error('createUserPreference called without a valid userId', {
        module: 'UserPreference',
        method: 'createUserPreference',
        data: {
          orgId,
          error: 'Missing userId in request data.',
        },
      });

      throw new Error('UserPreference: userId is required to create user preferences.');
    }

    try {
      const resource = endPointMap.userPreferenceCreate(orgId);

      LoggerProxy.info('Making API request to create user preferences', {
        module: 'UserPreference',
        method: 'createUserPreference',
        data: {
          resource,
          service: WCC_API_GATEWAY,
        },
      });

      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_SUCCESS);
      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_FAILED);

      const response = await this.webexRequest.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.POST,
        body: data,
      });

      LoggerProxy.info('Successfully created user preferences', {
        module: 'UserPreference',
        method: 'createUserPreference',
        data: {
          statusCode: response.statusCode,
          userId: data.userId,
        },
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_SUCCESS,
        {
          orgId,
          userId: data.userId,
          statusCode: response.statusCode,
        },
        ['behavioral', 'operational']
      );

      return response.body;
    } catch (error) {
      const errorData = {
        orgId,
        userId: data.userId,
        error: error instanceof Error ? error.message : String(error),
      };

      LoggerProxy.error('Failed to create user preferences', {
        module: 'UserPreference',
        method: 'createUserPreference',
        data: errorData,
        error,
      });

      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_CREATE_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw error;
    }
  }

  /**
   * Updates existing user preferences
   * @param {string} userId - User ID to update preferences for
   * @param {UpdateUserPreferenceRequest} data - The user preference data to update
   * @returns {Promise<UserPreference>} Promise resolving to updated user preferences
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * const updatedPreferences = await userPreferenceAPI.updateUserPreference('user123', {
   *   preferences: { e911Reminder: false }
   * });
   * ```
   */
  public async updateUserPreference(
    userId: string,
    data: UpdateUserPreferenceRequest
  ): Promise<UserPreferenceResponse> {
    const orgId = this.webex.credentials.getOrgId();

    LoggerProxy.info('Updating user preferences', {
      module: 'UserPreference',
      method: 'updateUserPreference',
      data: {
        orgId,
        userId,
      },
    });

    if (!userId) {
      LoggerProxy.error('updateUserPreference called without a valid userId', {
        module: 'UserPreference',
        method: 'updateUserPreference',
        data: {
          orgId,
          error: 'Missing userId parameter.',
        },
      });

      throw new Error('UserPreference: userId is required to update user preferences.');
    }

    try {
      const resource = endPointMap.userPreference(orgId, userId);

      LoggerProxy.info('Making API request to update user preferences', {
        module: 'UserPreference',
        method: 'updateUserPreference',
        data: {
          resource,
          service: WCC_API_GATEWAY,
        },
      });

      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_SUCCESS);
      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_FAILED);

      const response = await this.webexRequest.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.PUT,
        body: data,
      });

      LoggerProxy.info('Successfully updated user preferences', {
        module: 'UserPreference',
        method: 'updateUserPreference',
        data: {
          statusCode: response.statusCode,
          userId,
        },
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_SUCCESS,
        {
          orgId,
          userId,
          statusCode: response.statusCode,
        },
        ['behavioral', 'operational']
      );

      return response.body;
    } catch (error) {
      const errorData = {
        orgId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      };

      LoggerProxy.error('Failed to update user preferences', {
        module: 'UserPreference',
        method: 'updateUserPreference',
        data: errorData,
        error,
      });

      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_UPDATE_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw error;
    }
  }

  /**
   * Deletes user preferences for a specific user
   * @param {string} userId - User ID to delete preferences for
   * @returns {Promise<void>} Promise resolving when deletion is complete
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * await userPreferenceAPI.deleteUserPreference('user123');
   * ```
   */
  public async deleteUserPreference(userId: string): Promise<void> {
    const orgId = this.webex.credentials.getOrgId();

    LoggerProxy.info('Deleting user preferences', {
      module: 'UserPreference',
      method: 'deleteUserPreference',
      data: {
        orgId,
        userId,
      },
    });

    if (!userId) {
      LoggerProxy.error('deleteUserPreference called without a valid userId', {
        module: 'UserPreference',
        method: 'deleteUserPreference',
        data: {
          orgId,
          error: 'Missing userId parameter.',
        },
      });

      throw new Error('UserPreference: userId is required to delete user preferences.');
    }

    try {
      const resource = endPointMap.userPreference(orgId, userId);

      LoggerProxy.info('Making API request to delete user preferences', {
        module: 'UserPreference',
        method: 'deleteUserPreference',
        data: {
          resource,
          service: WCC_API_GATEWAY,
        },
      });

      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_SUCCESS);
      this.metricsManager.timeEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_FAILED);

      const response = await this.webexRequest.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.DELETE,
      });

      LoggerProxy.info('Successfully deleted user preferences', {
        module: 'UserPreference',
        method: 'deleteUserPreference',
        data: {
          statusCode: response.statusCode,
          userId,
        },
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_SUCCESS,
        {
          orgId,
          userId,
          statusCode: response.statusCode,
        },
        ['behavioral', 'operational']
      );
    } catch (error) {
      const errorData = {
        orgId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      };

      LoggerProxy.error('Failed to delete user preferences', {
        module: 'UserPreference',
        method: 'deleteUserPreference',
        data: errorData,
        error,
      });

      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.USER_PREFERENCE_DELETE_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw error;
    }
  }
}

export default UserPreference;

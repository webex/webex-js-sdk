/**
 * @packageDocumentation
 * @module QueueAPI
 */

import {HTTP_METHODS, WebexSDK} from './types';
import LoggerProxy from './logger-proxy';
import WebexRequest from './services/core/WebexRequest';
import PageCache, {
  PaginatedResponse,
  BaseSearchParams,
  PAGINATION_DEFAULTS,
} from './utils/PageCache';

/**
 * Interface for Queue Skill Requirement based on QueueSkillRequirementDTO from spec
 * @public
 */
export interface QueueSkillRequirement {
  /** Organization ID */
  organizationId?: string;
  /** Unique identifier for the skill requirement */
  id?: string;
  /** Version of the skill requirement */
  version?: number;
  /** Skill ID reference */
  skillId: string;
  /** Name of the skill */
  skillName?: string;
  /** Type of skill (PROFICIENCY, BOOLEAN, TEXT, ENUM) */
  skillType?: string;
  /** Condition for the skill requirement */
  condition: string;
  /** Value that represents the skill */
  skillValue: string;
  /** Creation timestamp in epoch millis */
  createdTime?: number;
  /** Last updated timestamp in epoch millis */
  lastUpdatedTime?: number;
}

/**
 * Interface for Queue Agent based on QueueAgentsDTO from spec
 * @public
 */
export interface QueueAgent {
  /** ID of an agent in WxCC */
  id: string;
  /** ID of an agent in Common Identity */
  ciUserId?: string;
}

/**
 * Interface for Agent Group based on AgentGroupDTO from spec
 * @public
 */
export interface AgentGroup {
  /** ID of a team */
  teamId: string;
}

/**
 * Interface for Call Distribution Group based on CallDistributionGroupDTO from spec
 * @public
 */
export interface CallDistributionGroup {
  /** Agent groups who are part of this call distribution group */
  agentGroups: AgentGroup[];
  /** Order of this call distribution group */
  order: number;
  /** Duration in seconds after which a contact in queue will be distributed to this group */
  duration?: number;
}

/**
 * Interface for Assistant Skill Mapping based on AssistantSkillMappingDTO from spec
 * @public
 */
export interface AssistantSkillMapping {
  /** ID of an Assistant Skill mapped to the Contact Service Queue */
  assistantSkillId?: string;
  /** Time when assistant skill mapping was last updated */
  assistantSkillUpdatedTime?: number;
}

/**
 * Interface for Contact Service Queue based on ContactServiceQueueDTO from spec
 * @public
 */
export interface ContactServiceQueue {
  /** Organization ID */
  organizationId?: string;
  /** Unique identifier for the queue */
  id?: string;
  /** Version of the queue */
  version?: number;
  /** Name of the Contact Service Queue */
  name: string;
  /** Description of the queue */
  description?: string;
  /** Queue type (INBOUND, OUTBOUND) */
  queueType: 'INBOUND' | 'OUTBOUND';
  /** Whether to check agent availability */
  checkAgentAvailability: boolean;
  /** Channel type (TELEPHONY, EMAIL, SOCIAL_CHANNEL, CHAT, etc.) */
  channelType: 'TELEPHONY' | 'EMAIL' | 'FAX' | 'CHAT' | 'VIDEO' | 'OTHERS' | 'SOCIAL_CHANNEL';
  /** Social channel type for SOCIAL_CHANNEL channelType */
  socialChannelType?:
    | 'MESSAGEBIRD'
    | 'MESSENGER'
    | 'WHATSAPP'
    | 'APPLE_BUSINESS_CHAT'
    | 'GOOGLE_BUSINESS_MESSAGES';
  /** Service level threshold in seconds */
  serviceLevelThreshold: number;
  /** Maximum number of simultaneous contacts */
  maxActiveContacts: number;
  /** Maximum time in queue in seconds */
  maxTimeInQueue: number;
  /** Default music in queue media file ID */
  defaultMusicInQueueMediaFileId: string;
  /** Timezone for routing strategies */
  timezone?: string;
  /** Whether the queue is active */
  active: boolean;
  /** Whether outdial campaign is enabled */
  outdialCampaignEnabled?: boolean;
  /** Whether monitoring is permitted */
  monitoringPermitted: boolean;
  /** Whether parking is permitted */
  parkingPermitted: boolean;
  /** Whether recording is permitted */
  recordingPermitted: boolean;
  /** Whether recording all calls is permitted */
  recordingAllCallsPermitted: boolean;
  /** Whether pausing recording is permitted */
  pauseRecordingPermitted: boolean;
  /** Recording pause duration in seconds */
  recordingPauseDuration?: number;
  /** Control flow script URL */
  controlFlowScriptUrl: string;
  /** IVR requeue URL */
  ivrRequeueUrl: string;
  /** Overflow number for telephony */
  overflowNumber?: string;
  /** Vendor ID */
  vendorId?: string;
  /** Routing type */
  routingType: 'LONGEST_AVAILABLE_AGENT' | 'SKILLS_BASED' | 'CIRCULAR' | 'LINEAR';
  /** Skills-based routing type */
  skillBasedRoutingType?: 'LONGEST_AVAILABLE_AGENT' | 'BEST_AVAILABLE_AGENT';
  /** Queue routing type */
  queueRoutingType: 'TEAM_BASED' | 'SKILL_BASED' | 'AGENT_BASED';
  /** Queue skill requirements */
  queueSkillRequirements?: QueueSkillRequirement[];
  /** List of agents for agent-based queue */
  agents?: QueueAgent[];
  /** Call distribution groups */
  callDistributionGroups: CallDistributionGroup[];
  /** XSP version */
  xspVersion?: string;
  /** Subscription ID */
  subscriptionId?: string;
  /** Assistant skill mapping */
  assistantSkill?: AssistantSkillMapping;
  /** Whether this is a system default queue */
  systemDefault?: boolean;
  /** User who last updated agents list */
  agentsLastUpdatedByUserName?: string;
  /** Email of user who last updated agents list */
  agentsLastUpdatedByUserEmailPrefix?: string;
  /** When agents list was last updated */
  agentsLastUpdatedTime?: number;
  /** Creation timestamp in epoch millis */
  createdTime?: number;
  /** Last updated timestamp in epoch millis */
  lastUpdatedTime?: number;
}

/**
 * Interface for paginated Contact Service Queues response based on spec
 * @public
 */
export type ContactServiceQueuesResponse = PaginatedResponse<ContactServiceQueue>;

/**
 * Interface for Contact Service Queue search parameters based on spec
 * @public
 */
export interface ContactServiceQueueSearchParams extends BaseSearchParams {
  /** Desktop profile filter */
  desktopProfileFilter?: boolean;
  /** Provisioning view */
  provisioningView?: boolean;
  /** Single object response */
  singleObjectResponse?: boolean;
}

/**
 * Queue API class for managing Webex Contact Center contact service queues.
 * Provides functionality to fetch contact service queues using the queue API.
 *
 * @class QueueAPI
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
 * // Get Queue API instance from ContactCenter
 * const queueAPI = cc.queue;
 *
 * // Get all queues
 * const queues = await queueAPI.getQueues();
 *
 * // Get queues with pagination
 * const queues = await queueAPI.getQueues({
 *   page: 0,
 *   pageSize: 50
 * });
 *
 * // Search for specific queues
 * const searchResults = await queueAPI.getQueues({
 *   search: 'support',
 *   filter: 'name=="Support Queue"'
 * });
 * ```
 */
export class QueueAPI {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;

  // Page cache using the common utility
  private pageCache: PageCache<ContactServiceQueue>;

  /**
   * Creates an instance of QueueAPI
   * @param {WebexSDK} webex - The Webex SDK instance
   * @public
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.pageCache = new PageCache<ContactServiceQueue>('QueueAPI');
  }

  /**
   * Fetches contact service queues for the organization
   * @param {ContactServiceQueueSearchParams} [params] - Search and pagination parameters
   * @returns {Promise<ContactServiceQueuesResponse>} Promise resolving to contact service queues
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Get all queues with default pagination
   * const response = await queueAPI.getQueues();
   *
   * // Get queues with specific pagination
   * const response = await queueAPI.getQueues({
   *   page: 0,
   *   pageSize: 25
   * });
   *
   * // Search for queues
   * const response = await queueAPI.getQueues({
   *   search: 'support',
   *   filter: 'queueType=="INBOUND"'
   * });
   * ```
   */
  public async getQueues(
    params: ContactServiceQueueSearchParams = {}
  ): Promise<ContactServiceQueuesResponse> {
    const {
      page = PAGINATION_DEFAULTS.PAGE,
      pageSize = PAGINATION_DEFAULTS.PAGE_SIZE,
      search,
      filter,
      attributes,
      sortBy,
      sortOrder,
      desktopProfileFilter,
      provisioningView,
      singleObjectResponse,
    } = params;

    const orgId = this.webex.credentials.getOrgId();

    LoggerProxy.info('Fetching contact service queues', {
      module: 'QueueAPI',
      method: 'getQueues',
    });

    // Check if we can use cache for simple pagination (no search/filter/attributes/sort)
    if (this.pageCache.canUseCache({search, filter, attributes, sortBy})) {
      const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
      const cachedPage = this.pageCache.getCachedPage(cacheKey);

      if (cachedPage) {
        LoggerProxy.log(`Returning page ${page} from cache`, {
          module: 'QueueAPI',
          method: 'getQueues',
        });

        return {
          data: cachedPage.data,
          meta: {
            page,
            pageSize,
            totalPages: cachedPage.totalMeta?.totalPages,
            totalRecords: cachedPage.totalMeta?.totalRecords,
            orgid: orgId,
          },
        };
      }
    }

    try {
      // Build query parameters according to spec
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filter) queryParams.append('filter', filter);
      if (attributes) queryParams.append('attributes', attributes);
      if (search) queryParams.append('search', search);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (desktopProfileFilter !== undefined)
        queryParams.append('desktopProfileFilter', desktopProfileFilter.toString());
      if (provisioningView !== undefined)
        queryParams.append('provisioningView', provisioningView.toString());
      if (singleObjectResponse !== undefined)
        queryParams.append('singleObjectResponse', singleObjectResponse.toString());

      const resource = `/organization/${orgId}/v2/contact-service-queue?${queryParams.toString()}`;

      const response = await this.webexRequest.request({
        service: 'wcc-api-gateway',
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(
          `API call failed with status ${response.statusCode}: ${
            response.body?.error?.message || response.body?.message || 'Unknown error'
          }`
        );
      }

      LoggerProxy.log(
        `Successfully retrieved ${response.body?.data?.length || 0} contact service queues`,
        {
          module: 'QueueAPI',
          method: 'getQueues',
        }
      );

      // Cache the page data for simple pagination (no search/filter/attributes/sort)
      if (this.pageCache.canUseCache({search, filter, attributes, sortBy}) && response.body?.data) {
        const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
        this.pageCache.cachePage(cacheKey, response.body.data, response.body.meta);
      }

      return response.body;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch contact service queues: ${error}`, {
        module: 'QueueAPI',
        method: 'getQueues',
      });
      throw error;
    }
  }
}

export default QueueAPI;

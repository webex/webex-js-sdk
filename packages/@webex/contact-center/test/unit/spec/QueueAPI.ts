import QueueAPI from '../../../src/services/QueueAPI';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../src/metrics/constants';
import WebexRequest from '../../../src/services/core/WebexRequest';
import MetricsManager from '../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../src/logger-proxy';

jest.mock('../../../src/services/core/WebexRequest');
jest.mock('../../../src/metrics/MetricsManager');
jest.mock('../../../src/logger-proxy');

describe('QueueAPI', () => {
  let queueAPI: QueueAPI;
  let mockWebex: WebexSDK;
  let mockWebexRequest: jest.Mocked<WebexRequest>;
  let mockMetricsManager: jest.Mocked<MetricsManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWebex = {
      credentials: {
        getOrgId: jest.fn().mockReturnValue('test-org-id'),
      },
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

    mockWebexRequest = {
      request: jest.fn(),
    } as unknown as jest.Mocked<WebexRequest>;
    (WebexRequest.getInstance as jest.Mock).mockReturnValue(mockWebexRequest);

    mockMetricsManager = {
      trackEvent: jest.fn(),
      timeEvent: jest.fn(),
    } as unknown as jest.Mocked<MetricsManager>;
    (MetricsManager.getInstance as jest.Mock).mockReturnValue(mockMetricsManager);

    queueAPI = new QueueAPI(mockWebex);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance).toHaveBeenCalledWith({webex: mockWebex});
      expect(MetricsManager.getInstance).toHaveBeenCalledWith({webex: mockWebex});
    });
  });

  describe('getQueues', () => {
    const mockQueues = [
      {
        id: 'queue1',
        name: 'Support Queue',
        queueType: 'INBOUND' as const,
        channelType: 'TELEPHONY' as const,
        active: true,
        organizationId: 'test-org-id',
        checkAgentAvailability: true,
        serviceLevelThreshold: 300,
        maxActiveContacts: 10,
        maxTimeInQueue: 3600,
        defaultMusicInQueueMediaFileId: 'media123',
        monitoringPermitted: true,
        parkingPermitted: true,
        recordingPermitted: true,
        recordingAllCallsPermitted: false,
        pauseRecordingPermitted: true,
        controlFlowScriptUrl: 'https://example.com/script',
        ivrRequeueUrl: 'https://example.com/requeue',
        routingType: 'LONGEST_AVAILABLE_AGENT' as const,
        queueRoutingType: 'TEAM_BASED' as const,
        callDistributionGroups: [
          {
            agentGroups: [{teamId: 'team1'}],
            order: 1,
            duration: 30
          }
        ],
      },
      {
        id: 'queue2',
        name: 'Sales Queue',
        queueType: 'INBOUND' as const,
        channelType: 'CHAT' as const,
        active: true,
        organizationId: 'test-org-id',
        checkAgentAvailability: true,
        serviceLevelThreshold: 300,
        maxActiveContacts: 5,
        maxTimeInQueue: 1800,
        defaultMusicInQueueMediaFileId: 'media456',
        monitoringPermitted: true,
        parkingPermitted: false,
        recordingPermitted: false,
        recordingAllCallsPermitted: false,
        pauseRecordingPermitted: false,
        controlFlowScriptUrl: 'https://example.com/script2',
        ivrRequeueUrl: 'https://example.com/requeue2',
        routingType: 'SKILLS_BASED' as const,
        queueRoutingType: 'SKILL_BASED' as const,
        callDistributionGroups: [
          {
            agentGroups: [{teamId: 'team2'}],
            order: 1,
            duration: 60
          }
        ],
      },
    ];

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      method: 'GET',
      url: '/organization/test-org-id/v2/contact-service-queue',
      headers: {} as any,
      body: {
        data: mockQueues,
        meta: {
          page: 0,
          pageSize: 100,
          totalPages: 1,
          totalRecords: 2,
          orgid: 'test-org-id',
        },
      },
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch contact service queues successfully with default parameters', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const result = await queueAPI.getQueues();

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/contact-service-queue?page=0&pageSize=100',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          statusCode: 200,
          recordCount: 2,
          totalRecords: 2,
          isSearchRequest: false,
          isFirstPage: true,
        },
        ['behavioral', 'operational']
      );
      expect(LoggerProxy.info).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalled();
    });

    it('should fetch queues with custom parameters', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const params = {
        page: 1,
        pageSize: 25,
        search: 'support',
        filter: 'queueType=="INBOUND"',
        attributes: 'id,name,queueType',
        sortBy: 'name',
        sortOrder: 'desc' as const,
        desktopProfileFilter: true,
        provisioningView: false,
        singleObjectResponse: true,
      };

      await queueAPI.getQueues(params);

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/contact-service-queue?page=1&pageSize=25&filter=queueType%3D%3D%22INBOUND%22&attributes=id%2Cname%2CqueueType&search=support&sortBy=name&sortOrder=desc&desktopProfileFilter=true&provisioningView=false&singleObjectResponse=true',
        method: HTTP_METHODS.GET,
      });

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS,
        expect.objectContaining({
          isSearchRequest: true,
          isFirstPage: false,
        }),
        ['behavioral', 'operational']
      );
    });

    it('should handle API errors and track metrics', async () => {
      const errorResponse: IHttpResponse = {
        statusCode: 500,
        method: 'GET',
        url: '/organization/test-org-id/v2/contact-service-queue',
        headers: {} as any,
        body: {
          error: {
            message: 'Internal Server Error',
          },
        },
      };
      mockWebexRequest.request.mockResolvedValue(errorResponse);

      await expect(queueAPI.getQueues()).rejects.toThrow(
        'API call failed with status 500: Internal Server Error'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          statusCode: 500,
          errorMessage: 'Internal Server Error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        },
        ['behavioral']
      );
      expect(LoggerProxy.error).toHaveBeenCalled();
    });

    it('should handle network errors and track metrics', async () => {
      const networkError = new Error('Network error');
      mockWebexRequest.request.mockRejectedValue(networkError);

      await expect(queueAPI.getQueues()).rejects.toThrow('Network error');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          error: 'Network error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        },
        ['behavioral', 'operational']
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'Failed to fetch contact service queues',
        {
          module: 'QueueAPI',
          method: 'getQueues',
          data: {
            orgId: 'test-org-id',
            error: 'Network error',
            isSearchRequest: false,
            page: 0,
            pageSize: 100,
          },
          error: networkError,
        }
      );
    });

    it('should not track metrics for subsequent pages in simple pagination', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      await queueAPI.getQueues({page: 2});

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS,
        expect.any(Object),
        expect.any(Array)
      );
    });

    it('should track metrics for search requests on any page', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      await queueAPI.getQueues({page: 2, search: 'test'});

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS,
        expect.objectContaining({
          isSearchRequest: true,
          isFirstPage: false,
        }),
        ['behavioral', 'operational']
      );
    });
  });
});

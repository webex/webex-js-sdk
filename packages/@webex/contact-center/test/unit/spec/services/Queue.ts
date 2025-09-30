import Queue from '../../../../src/services/Queue';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';

jest.mock('../../../../src/metrics/MetricsManager');
jest.mock('../../../../src/logger-proxy');

describe('Queue', () => {
  let queueAPI: Queue;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;

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

    queueAPI = new Queue(mockWebex);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance({webex: mockWebex})).toBeDefined();
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
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await queueAPI.getQueues();

      expect(mockWebex.request).toHaveBeenCalledWith({
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
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching contact service queues', {
        module: 'Queue',
        method: 'getQueues',
        data: expect.objectContaining({
          orgId: 'test-org-id',
          page: 0,
          pageSize: 100,
          isSearchRequest: false,
        }),
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('Making API request to fetch contact service queues', {
        module: 'Queue',
        method: 'getQueues',
        data: expect.objectContaining({
          resource: '/organization/test-org-id/v2/contact-service-queue?page=0&pageSize=100',
          service: 'wcc-api-gateway',
        }),
      });
    });

    it('should fetch queues with custom parameters', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

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

      expect(mockWebex.request).toHaveBeenCalledWith({
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
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Internal Server Error'));

      await expect(queueAPI.getQueues()).rejects.toThrow('Internal Server Error');

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/contact-service-queue?page=0&pageSize=100',
        method: HTTP_METHODS.GET,
      });

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          error: 'Internal Server Error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        },
        ['behavioral', 'operational']
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith('Failed to fetch contact service queues', {
        module: 'Queue',
        method: 'getQueues',
        data: expect.objectContaining({
          orgId: 'test-org-id',
          error: 'Internal Server Error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        }),
        error: expect.any(Error),
      });
    });



    it('should not track metrics for subsequent pages in simple pagination', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await queueAPI.getQueues({page: 2});
      expect(result).toEqual(mockResponse.body);

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should track metrics for search requests on any page', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result2 = await queueAPI.getQueues({page: 2, search: 'test'});
      expect(result2).toEqual(mockResponse.body);

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS,
        expect.objectContaining({
          isSearchRequest: true,
          isFirstPage: false,
        }),
        ['behavioral', 'operational']
      );
    });

    it('should call API when requested page is not cached (cache miss)', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValueOnce(mockResponse);

      await queueAPI.getQueues({page: 0});

      (mockWebex.request as jest.Mock).mockResolvedValueOnce({
        ...mockResponse,
        body: {
          data: mockQueues,
          meta: {
            page: 1,
            pageSize: 100,
            totalPages: 2,
            totalRecords: 2,
            orgid: 'test-org-id',
          },
        },
      });

      const callsBefore = (mockWebex.request as jest.Mock).mock.calls.length;
      (LoggerProxy.log as jest.Mock).mockClear();

      const result = await queueAPI.getQueues({page: 1});
      const callsAfter = (mockWebex.request as jest.Mock).mock.calls.length;

      expect(callsAfter).toBe(callsBefore + 1);
      expect(result.meta.page).toBe(1);
      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/contact-service-queue?page=1&pageSize=100',
        method: HTTP_METHODS.GET,
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('Making API request to fetch contact service queues', {
        module: 'Queue',
        method: 'getQueues',
        data: expect.objectContaining({
          resource: '/organization/test-org-id/v2/contact-service-queue?page=1&pageSize=100',
          service: 'wcc-api-gateway',
        }),
      });
    });
  });
});

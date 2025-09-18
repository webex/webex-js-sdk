import EntryPointAPI from '../../../src/EntryPointAPI';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../src/metrics/constants';
import WebexRequest from '../../../src/services/core/WebexRequest';
import MetricsManager from '../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../src/logger-proxy';

jest.mock('../../../src/services/core/WebexRequest');
jest.mock('../../../src/metrics/MetricsManager');
jest.mock('../../../src/logger-proxy');

describe('EntryPointAPI', () => {
  let entryPointAPI: EntryPointAPI;
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

    entryPointAPI = new EntryPointAPI(mockWebex);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance).toHaveBeenCalledWith({webex: mockWebex});
      expect(MetricsManager.getInstance).toHaveBeenCalledWith({webex: mockWebex});
    });
  });

  describe('getEntryPoints', () => {
    const mockEntryPoints = [
      {
        id: 'entry1',
        name: 'Test Entry Point 1',
        type: 'voice',
        isActive: true,
        orgId: 'test-org-id',
      },
      {
        id: 'entry2',
        name: 'Test Entry Point 2',
        type: 'chat',
        isActive: true,
        orgId: 'test-org-id',
      },
    ];

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      method: 'GET',
      url: '/organization/test-org-id/v2/entry-point',
      headers: {} as any,
      body: {
        data: mockEntryPoints,
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

    it('should fetch entry points successfully with default parameters', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const result = await entryPointAPI.getEntryPoints();

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/entry-point?page=0&pageSize=100&sortOrder=asc',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          statusCode: 200,
          recordCount: 2,
          totalRecords: 2,
          isSearchRequest: false,
          isFirstPage: true,
        },
        ['behavioral']
      );
      expect(LoggerProxy.info).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalled();
    });

    it('should fetch entry points with custom parameters', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const params = {
        page: 1,
        pageSize: 25,
        search: 'test',
        filter: 'type=="voice"',
        attributes: 'id,name',
        sortBy: 'name',
        sortOrder: 'desc' as const,
      };

      await entryPointAPI.getEntryPoints(params);

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/entry-point?page=1&pageSize=25&sortOrder=desc&search=test&filter=type%3D%3D%22voice%22&attributes=id%2Cname&sortBy=name',
        method: HTTP_METHODS.GET,
      });

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          statusCode: 200,
          recordCount: 2,
          totalRecords: 2,
          isSearchRequest: true,
          isFirstPage: false,
        },
        ['behavioral']
      );
    });

    it('should handle API errors and track metrics', async () => {
      const errorResponse: IHttpResponse = {
        statusCode: 500,
        method: 'GET',
        url: '/organization/test-org-id/v2/entry-point',
        headers: {} as any,
        body: {
          error: {
            message: 'Internal Server Error',
          },
        },
      };
      mockWebexRequest.request.mockResolvedValue(errorResponse);

      await expect(entryPointAPI.getEntryPoints()).rejects.toThrow(
        'API call failed with status 500: Internal Server Error'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_FAILED,
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

      await expect(entryPointAPI.getEntryPoints()).rejects.toThrow('Network error');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          error: 'Network error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        },
        ['behavioral']
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'Failed to fetch entry points',
        {
          module: 'EntryPointAPI',
          method: 'getEntryPoints',
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

      await entryPointAPI.getEntryPoints({page: 2});

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS,
        expect.any(Object),
        expect.any(Array)
      );
    });

    it('should track metrics for search requests on any page', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      await entryPointAPI.getEntryPoints({page: 2, search: 'test'});

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          statusCode: 200,
          recordCount: 2,
          totalRecords: 2,
          isSearchRequest: true,
          isFirstPage: false,
        },
        ['behavioral']
      );
    });
  });
});

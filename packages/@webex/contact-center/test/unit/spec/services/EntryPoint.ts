import EntryPoint from '../../../../src/services/EntryPoint';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';

jest.mock('../../../../src/metrics/MetricsManager');
jest.mock('../../../../src/logger-proxy');

describe('EntryPoint', () => {
  let entryPointAPI: EntryPoint;
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

    entryPointAPI = new EntryPoint(mockWebex);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance({webex: mockWebex})).toBeDefined();
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
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await entryPointAPI.getEntryPoints();

      expect(mockWebex.request).toHaveBeenCalledWith({
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
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Fetching entry points - orgId: test-org-id, page: 0, pageSize: 100, isSearchRequest: false',
        {module: 'EntryPoint', method: 'getEntryPoints'}
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Making API request to fetch entry points - resource: /organization/test-org-id/v2/entry-point?page=0&pageSize=100&sortOrder=asc, service: wcc-api-gateway`,
        {module: 'EntryPoint', method: 'getEntryPoints'}
      );
    });

    it('should fetch entry points with custom parameters', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

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

      expect(mockWebex.request).toHaveBeenCalledWith({
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
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Internal Server Error'));

      await expect(entryPointAPI.getEntryPoints()).rejects.toThrow('Internal Server Error');

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/entry-point?page=0&pageSize=100&sortOrder=asc',
        method: HTTP_METHODS.GET,
      });

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          error: 'Internal Server Error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        },
        ['behavioral']
      );
      expect(LoggerProxy.error).toHaveBeenCalled();
    });



    it('should not track metrics for subsequent pages in simple pagination', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await entryPointAPI.getEntryPoints({page: 2});
      expect(result).toEqual(mockResponse.body);

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should track metrics for search requests on any page', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result2 = await entryPointAPI.getEntryPoints({page: 2, search: 'test'});
      expect(result2).toEqual(mockResponse.body);

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

    it('should call API when requested page is not cached (cache miss)', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValueOnce(mockResponse);

      await entryPointAPI.getEntryPoints({page: 0});

      (mockWebex.request as jest.Mock).mockResolvedValueOnce({
        ...mockResponse,
        body: {
          data: mockEntryPoints,
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

      const result = await entryPointAPI.getEntryPoints({page: 1});
      const callsAfter = (mockWebex.request as jest.Mock).mock.calls.length;

      expect(callsAfter).toBe(callsBefore + 1);
      expect(result.meta.page).toBe(1);
      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/entry-point?page=1&pageSize=100&sortOrder=asc',
        method: HTTP_METHODS.GET,
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Making API request to fetch entry points - resource: /organization/test-org-id/v2/entry-point?page=1&pageSize=100&sortOrder=asc, service: wcc-api-gateway`,
        {module: 'EntryPoint', method: 'getEntryPoints'}
      );
    });
  });
});

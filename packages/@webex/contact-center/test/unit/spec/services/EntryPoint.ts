import EntryPoint from '../../../../src/services/EntryPoint';
import {HTTP_METHODS, WebexSDK, IHttpResponse, EntryPointRecord} from '../../../../src/types';
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
    const mockDialNumberMappings = [
      {
        id: 'dial-number-1',
        dialledNumber: '+1-555-0101',
        entryPointId: 'entry1',
        entryPointName: 'Test Entry Point 1',
      },
      {
        id: 'dial-number-2',
        dialledNumber: '+1-555-0102',
        entryPointId: 'entry2',
        entryPointName: 'Test Entry Point 2',
      },
    ];
    const expectedEntryPoints: EntryPointRecord[] = [
      {id: 'entry1', name: 'Test Entry Point 1', number: '+1-555-0101'},
      {id: 'entry2', name: 'Test Entry Point 2', number: '+1-555-0102'},
    ];
    const defaultResource =
      '/organization/test-org-id/v3/dial-number?page=0&pageSize=100&attributes=id%2CdialledNumber%2CentryPointId%2CentryPointName&sort=entryPointName%2CASC&desktopProfileFilter=true&includeEntryPointName=true';
    const requestHeaders = {
      'X-ORGANIZATION-ID': 'test-org-id',
      'x-ignore-internal-data': 'false',
    };

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      method: 'GET',
      url: '/organization/test-org-id/v3/dial-number',
      headers: {} as any,
      body: {
        data: mockDialNumberMappings,
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
        resource: defaultResource,
        method: HTTP_METHODS.GET,
        body: undefined,
        headers: requestHeaders,
      });

      expect(result).toEqual({...mockResponse.body, data: expectedEntryPoints});
      expect(result.data[0].number).toBe('+1-555-0101');
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
        `Making API request to fetch entry points - resource: ${defaultResource}, service: wcc-api-gateway`,
        {module: 'EntryPoint', method: 'getEntryPoints'}
      );
    });

    it('should fetch entry points with custom parameters', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const params = {
        page: 1,
        pageSize: 25,
        search: 'test',
        filter: 'entryPointId=="entry1"',
        attributes: 'id,name',
        sortBy: 'name',
        sortOrder: 'desc' as const,
      };

      await entryPointAPI.getEntryPoints(params);

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource:
          '/organization/test-org-id/v3/dial-number?page=1&pageSize=25&attributes=id%2CdialledNumber%2CentryPointId%2CentryPointName%2Cname&search=fields%3Din%3D%28%22entryPointName%22%2C%22dialledNumber%22%29%3Bvalue%3D%3D%22test%22&filter=entryPointId%3D%3D%22entry1%22&sort=entryPointName%2CDESC&desktopProfileFilter=true&includeEntryPointName=true',
        method: HTTP_METHODS.GET,
        body: undefined,
        headers: requestHeaders,
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

    it('should allow existing parameters to override the default entry-point mapping policy', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await entryPointAPI.getEntryPoints({
        page: 1,
        pageSize: 25,
        search: 'sales',
        filter: 'entryPointId==entry1',
      });

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource:
          '/organization/test-org-id/v3/dial-number?page=1&pageSize=25&attributes=id%2CdialledNumber%2CentryPointId%2CentryPointName&search=fields%3Din%3D%28%22entryPointName%22%2C%22dialledNumber%22%29%3Bvalue%3D%3D%22sales%22&filter=entryPointId%3D%3Dentry1&sort=entryPointName%2CASC&desktopProfileFilter=true&includeEntryPointName=true',
        method: HTTP_METHODS.GET,
        body: undefined,
        headers: requestHeaders,
      });
      expect(result).toEqual({...mockResponse.body, data: expectedEntryPoints});
    });

    it('should issue every profile-scoped request directly', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      await entryPointAPI.getEntryPoints();
      await entryPointAPI.getEntryPoints();

      expect(mockWebex.request).toHaveBeenCalledTimes(2);
      expect(mockWebex.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          resource: expect.stringContaining('desktopProfileFilter=true'),
        })
      );
    });

    it('should handle API errors and track metrics', async () => {
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Internal Server Error'));

      await expect(entryPointAPI.getEntryPoints()).rejects.toThrow('Internal Server Error');

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: defaultResource,
        method: HTTP_METHODS.GET,
        body: undefined,
        headers: requestHeaders,
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

    it('should not track success metrics for subsequent pages under the default mapping policy', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await entryPointAPI.getEntryPoints({page: 2});
      expect(result).toEqual({...mockResponse.body, data: expectedEntryPoints});

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS,
        expect.anything(),
        expect.anything()
      );
    });

    it('should track metrics for search requests on any page', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result2 = await entryPointAPI.getEntryPoints({page: 2, search: 'test'});
      expect(result2).toEqual({...mockResponse.body, data: expectedEntryPoints});

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

    it('should escape search values before building the CMS filter', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      await entryPointAPI.getEntryPoints({search: 'Sales";active==false'});

      const resource = (mockWebex.request as jest.Mock).mock.calls[0][0].resource as string;
      const query = new URLSearchParams(resource.split('?')[1]);

      expect(query.get('search')).toBe(
        'fields=in=("entryPointName","dialledNumber");value=="Sales\\"\\;active==false"'
      );
    });

    it('should request the specified page', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue({
        ...mockResponse,
        body: {
          data: mockDialNumberMappings,
          meta: {
            page: 1,
            pageSize: 100,
            totalPages: 2,
            totalRecords: 2,
            orgid: 'test-org-id',
          },
        },
      });

      const result = await entryPointAPI.getEntryPoints({page: 1});

      expect(result.meta.page).toBe(1);
      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource:
          '/organization/test-org-id/v3/dial-number?page=1&pageSize=100&attributes=id%2CdialledNumber%2CentryPointId%2CentryPointName&sort=entryPointName%2CASC&desktopProfileFilter=true&includeEntryPointName=true',
        method: HTTP_METHODS.GET,
        body: undefined,
        headers: requestHeaders,
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Making API request to fetch entry points - resource: /organization/test-org-id/v3/dial-number?page=1&pageSize=100&attributes=id%2CdialledNumber%2CentryPointId%2CentryPointName&sort=entryPointName%2CASC&desktopProfileFilter=true&includeEntryPointName=true, service: wcc-api-gateway`,
        {module: 'EntryPoint', method: 'getEntryPoints'}
      );
    });
  });
});

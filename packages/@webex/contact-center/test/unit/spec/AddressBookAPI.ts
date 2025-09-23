import AddressBookAPI from '../../../src/services/AddressBookAPI';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../src/metrics/constants';
import WebexRequest from '../../../src/services/core/WebexRequest';
import MetricsManager from '../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../src/logger-proxy';

jest.mock('../../../src/services/core/WebexRequest');
jest.mock('../../../src/metrics/MetricsManager');
jest.mock('../../../src/logger-proxy');

describe('AddressBookAPI', () => {
  let addressBookAPI: AddressBookAPI;
  let mockWebex: WebexSDK;
  let mockWebexRequest: jest.Mocked<WebexRequest>;
  let mockMetricsManager: jest.Mocked<MetricsManager>;

  const mockGetAddressBookId = jest.fn().mockReturnValue('test-address-book-id');

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

    addressBookAPI = new AddressBookAPI(mockWebex, mockGetAddressBookId);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance).toHaveBeenCalledWith({webex: mockWebex});
      expect(MetricsManager.getInstance).toHaveBeenCalledWith({webex: mockWebex});
    });
  });

  describe('getEntries', () => {
    const mockEntries = [
      {
        id: 'entry1',
        name: 'John Doe',
        number: '+1234567890',
        organizationId: 'test-org-id',
      },
      {
        id: 'entry2',
        name: 'Jane Smith',
        number: '+0987654321',
        organizationId: 'test-org-id',
      },
    ];

    const mockResponse: IHttpResponse = {
      statusCode: 200,
      method: 'GET',
      url: '/organization/test-org-id/v2/address-book/test-address-book-id/entry',
      headers: {} as any,
      body: {
        data: mockEntries,
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

    it('should fetch address book entries successfully with default parameters', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const result = await addressBookAPI.getEntries();

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/address-book/test-address-book-id/entry?page=0&pageSize=100',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith(METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
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

    it('should fetch entries with custom parameters', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      const params = {
        addressBookId: 'custom-book-id',
        page: 1,
        pageSize: 25,
        search: 'john',
        filter: 'name=="John Doe"',
        attributes: 'id,name,number',
      };

      await addressBookAPI.getEntries(params);

      expect(mockWebexRequest.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/address-book/custom-book-id/entry?page=1&pageSize=25&filter=name%3D%3D%22John+Doe%22&attributes=id%2Cname%2Cnumber&search=john',
        method: HTTP_METHODS.GET,
      });

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          bookId: 'custom-book-id',
          statusCode: 200,
          recordCount: 2,
          totalRecords: 2,
          isSearchRequest: true,
          isFirstPage: false,
        },
        ['behavioral', 'operational']
      );
    });

    it('should handle API errors and track metrics', async () => {
      const errorResponse: IHttpResponse = {
        statusCode: 500,
        method: 'GET',
        url: '/organization/test-org-id/v2/address-book/test-address-book-id/entry',
        headers: {} as any,
        body: {
          error: {
            message: 'Internal Server Error',
          },
        },
      };
      mockWebexRequest.request.mockResolvedValue(errorResponse);

      await expect(addressBookAPI.getEntries()).rejects.toThrow(
        'API call failed with status 500: Internal Server Error'
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
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

      await expect(addressBookAPI.getEntries()).rejects.toThrow('Network error');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_FAILED,
        {
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
          error: 'Network error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        },
        ['behavioral', 'operational']
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'Failed to fetch address book entries',
        {
          module: 'AddressBookAPI',
          method: 'getEntries',
          data: {
            orgId: 'test-org-id',
            bookId: 'test-address-book-id',
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

      await addressBookAPI.getEntries({page: 2});

      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS,
        expect.any(Object),
        expect.any(Array)
      );
    });

    it('should track metrics for search requests on any page', async () => {
      mockWebexRequest.request.mockResolvedValue(mockResponse);

      await addressBookAPI.getEntries({page: 2, search: 'test'});

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS,
        {
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
          statusCode: 200,
          recordCount: 2,
          totalRecords: 2,
          isSearchRequest: true,
          isFirstPage: false,
        },
        ['behavioral', 'operational']
      );
    });
  });
});

import AddressBook from '../../../../src/services/AddressBook';
import {HTTP_METHODS, WebexSDK, IHttpResponse} from '../../../../src/types';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import WebexRequest from '../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../src/logger-proxy';

jest.mock('../../../../src/metrics/MetricsManager');
jest.mock('../../../../src/logger-proxy');

describe('AddressBook', () => {
  let addressBookAPI: AddressBook;
  let mockWebex: WebexSDK;
  let mockMetricsManager: jest.Mocked<MetricsManager>;

  const mockGetAddressBookId = jest.fn().mockReturnValue('test-address-book-id');

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

    addressBookAPI = new AddressBook(mockWebex, mockGetAddressBookId);
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(WebexRequest.getInstance({webex: mockWebex})).toBeDefined();
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
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await addressBookAPI.getEntries();

      expect(mockWebex.request).toHaveBeenCalledWith({
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
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching address book entries', {
        module: 'AddressBook',
        method: 'getEntries',
        data: expect.objectContaining({
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
          page: 0,  
          pageSize: 100,
          isSearchRequest: false,
        }),
      });
      expect(LoggerProxy.info).toHaveBeenCalledWith('Making API request to fetch address book entries', {
        module: 'AddressBook',
        method: 'getEntries',
        data: {
          resource: '/organization/test-org-id/v2/address-book/test-address-book-id/entry?page=0&pageSize=100',
          service: 'wcc-api-gateway',
        },
      });
    });

    it('should fetch entries with custom parameters', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const params = {
        addressBookId: 'custom-book-id',
        page: 1,
        pageSize: 25,
        search: 'john',
        filter: 'name=="John Doe"',
        attributes: 'id,name,number',
      };

      const result = await addressBookAPI.getEntries(params);

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/address-book/custom-book-id/entry?page=1&pageSize=25&filter=name%3D%3D%22John+Doe%22&attributes=id%2Cname%2Cnumber&search=john',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(mockResponse.body);
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
      (mockWebex.request as jest.Mock).mockRejectedValue(new Error('Internal Server Error'));

      await expect(addressBookAPI.getEntries()).rejects.toThrow('Internal Server Error');

      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/address-book/test-address-book-id/entry?page=0&pageSize=100',
        method: HTTP_METHODS.GET,
      });

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_FAILED,
        expect.objectContaining({
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
          error: 'Internal Server Error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        }),
        ['behavioral', 'operational']
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith('Failed to fetch address book entries', {
        module: 'AddressBook',
        method: 'getEntries',
        data: expect.objectContaining({
          orgId: 'test-org-id',
          bookId: 'test-address-book-id',
          error: 'Internal Server Error',
          isSearchRequest: false,
          page: 0,
          pageSize: 100,
        }),
        error: expect.any(Error),
      }); 
    });

    it('should not track metrics for subsequent pages in simple pagination', async () => {
      const mockResponsePage2: IHttpResponse = {
        statusCode: 200,
        method: 'GET',
        url: '/organization/test-org-id/v2/address-book/test-address-book-id/entry',
        headers: {} as any,
        body: {
          data: mockEntries,
          meta: {
            page: 2,
            pageSize: 100,
            totalPages: 3,
            totalRecords: 2,
            orgid: 'test-org-id',
          },
        },
      };

      (mockWebex.request as jest.Mock).mockResolvedValueOnce(mockResponsePage2);

      const result = await addressBookAPI.getEntries({page: 2});

      expect(result).toEqual(mockResponsePage2.body);
      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS,
        expect.any(Object),
        expect.any(Array)
      );
    });

    it('should track metrics for search requests on a valid non-first page', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await addressBookAPI.getEntries({page: 1, search: 'test'});
      expect(result).toEqual(mockResponse.body);

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

    it('should return cached data for repeat simple pagination calls', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValueOnce(mockResponse);

      const first = await addressBookAPI.getEntries({page: 0});
      expect(first).toEqual(mockResponse.body);

      const callsBefore = (mockWebex.request as jest.Mock).mock.calls.length;
      const second = await addressBookAPI.getEntries({page: 0});
      const callsAfter = (mockWebex.request as jest.Mock).mock.calls.length;

      expect(second.data).toEqual(mockResponse.body.data);
      expect(second.meta).toEqual(
        expect.objectContaining({
          page: 0,
          pageSize: 100,
          totalPages: 1,
          totalRecords: 2,
        })
      );
      expect(callsAfter).toBe(callsBefore);
    });

    it('should call API when requested page is not cached (cache miss)', async () => {
      (mockWebex.request as jest.Mock).mockResolvedValueOnce(mockResponse);

      await addressBookAPI.getEntries({page: 0});

      (mockWebex.request as jest.Mock).mockResolvedValueOnce({
        ...mockResponse,
        body: {
          data: mockEntries,
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
      (LoggerProxy.info as jest.Mock).mockClear();
      (LoggerProxy.log as jest.Mock).mockClear();

      const result = await addressBookAPI.getEntries({page: 1});

      const callsAfter = (mockWebex.request as jest.Mock).mock.calls.length;
      expect(callsAfter).toBe(callsBefore + 1);
      expect(result.meta.page).toBe(1);
      expect(mockWebex.request).toHaveBeenCalledWith({
        service: 'wcc-api-gateway',
        resource: '/organization/test-org-id/v2/address-book/test-address-book-id/entry?page=1&pageSize=100',
        method: HTTP_METHODS.GET,
      });
      expect(LoggerProxy.info).toHaveBeenCalledWith('Making API request to fetch address book entries', {
        module: 'AddressBook',
        method: 'getEntries',
        data: {
          resource: '/organization/test-org-id/v2/address-book/test-address-book-id/entry?page=1&pageSize=100',
          service: 'wcc-api-gateway',
        },
      });
    });
  });
});

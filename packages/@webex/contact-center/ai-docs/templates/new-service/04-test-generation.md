# New Service - Test Generation

> **Purpose**: Create unit tests for the new service.

---

## Test File Location

Create: `test/unit/spec/services/ServiceName.ts`

---

## Test File Template

```typescript
import 'jsdom-global/register';
import MockWebex from '@webex/test-helper-mock-webex';
import ServiceName, {
  ServiceListResponse,
  ServiceSearchParams,
} from '../../../../src/services/ServiceName';

jest.mock('../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
    initialize: jest.fn(),
  },
}));

describe('ServiceName', () => {
  let webex: any;
  let service: ServiceName;
  
  // Mock data
  const mockOrgId = 'mock-org-id';
  const mockResponse: ServiceListResponse = {
    data: [
      { id: 'item-1', name: 'Item 1' },
      { id: 'item-2', name: 'Item 2' },
    ],
    meta: {
      page: 0,
      pageSize: 50,
      totalPages: 1,
      totalRecords: 2,
    },
  };

  beforeEach(() => {
    webex = MockWebex({
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      credentials: {
        getOrgId: jest.fn(() => mockOrgId),
      },
      request: jest.fn(),
    });

    service = new ServiceName(webex);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getItems', () => {
    it('should fetch items successfully', async () => {
      // Arrange
      webex.request.mockResolvedValue({ body: mockResponse });

      // Act
      const result = await service.getItems();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(webex.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: expect.stringContaining(mockOrgId),
      });
    });

    it('should apply pagination parameters', async () => {
      // Arrange
      webex.request.mockResolvedValue({ body: mockResponse });
      const params: ServiceSearchParams = { page: 1, pageSize: 25 };

      // Act
      await service.getItems(params);

      // Assert
      expect(webex.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: expect.stringContaining('page=1'),
      });
      expect(webex.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: expect.stringContaining('pageSize=25'),
      });
    });

    it('should apply search parameter', async () => {
      // Arrange
      webex.request.mockResolvedValue({ body: mockResponse });
      const params: ServiceSearchParams = { search: 'test' };

      // Act
      await service.getItems(params);

      // Assert
      expect(webex.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: expect.stringContaining('search=test'),
      });
    });

    it('should throw error on API failure', async () => {
      // Arrange
      const mockError = new Error('API Error');
      webex.request.mockRejectedValue(mockError);

      // Act & Assert
      await expect(service.getItems()).rejects.toThrow('API Error');
    });
  });

  describe('getItemById', () => {
    it('should fetch single item successfully', async () => {
      // Arrange
      const mockItem = { id: 'item-1', name: 'Item 1' };
      webex.request.mockResolvedValue({ body: mockItem });

      // Act
      const result = await service.getItemById('item-1');

      // Assert
      expect(result).toEqual(mockItem);
      expect(webex.request).toHaveBeenCalledWith({
        method: 'GET',
        uri: expect.stringContaining('item-1'),
      });
    });

    it('should throw error if item not found', async () => {
      // Arrange
      const mockError = new Error('Not Found');
      webex.request.mockRejectedValue(mockError);

      // Act & Assert
      await expect(service.getItemById('invalid-id')).rejects.toThrow('Not Found');
    });
  });
});
```

---

## Test Integration with cc.ts

Add to `test/unit/spec/cc.ts`:

```typescript
describe('cc.serviceName', () => {
  it('should initialize service on ready', () => {
    expect(webex.cc.serviceName).toBeDefined();
  });

  it('should fetch items through service', async () => {
    // Mock the service method
    const mockResponse = { data: [], meta: {} };
    jest.spyOn(webex.cc.serviceName, 'getItems').mockResolvedValue(mockResponse);

    // Act
    const result = await webex.cc.serviceName.getItems();

    // Assert
    expect(result).toEqual(mockResponse);
  });
});
```

---

## Running Tests

```bash
# Run specific test file
yarn workspace @webex/contact-center test -- --testPathPattern=ServiceName

# Run with coverage
yarn workspace @webex/contact-center test -- --coverage --testPathPattern=ServiceName
```

---

## Next Step

Proceed to: [`05-validation.md`](05-validation.md)

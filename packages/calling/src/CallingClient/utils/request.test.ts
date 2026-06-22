import {v4 as uuid} from 'uuid';
import {getTestUtilsWebex} from '../../common/testUtil';
import {HTTP_METHODS, WebexRequestPayload} from '../../common/types';
import log from '../../Logger';
import {APIRequest, createAPIRequest} from './request';
import {getMobiusSocketInstance} from '../../mobius-socket';
import {getMetricManager} from '../../Metrics';
import {METRIC_EVENT, METRIC_TYPE, MOBIUS_SOCKET_ACTION} from '../../Metrics/types';
import {isMobiusWssEnabled} from './wsFeatureFlag';
import {MOBIUS_SOCKET_DISCONNECT_REASON, MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';
import {MobiusSocketResponse, MobiusAsyncEvent} from './types';

// Mock dependencies
jest.mock('../../mobius-socket', () => ({
  getMobiusSocketInstance: jest.fn(),
}));
jest.mock('../../Metrics', () => ({
  getMetricManager: jest.fn(),
}));
jest.mock('./wsFeatureFlag', () => ({
  isMobiusWssEnabled: jest.fn(),
}));
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('APIRequest', () => {
  let webex: ReturnType<typeof getTestUtilsWebex>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMobiusSocket: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMetricManager: any;
  let infoSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    APIRequest.resetInstance();
    webex = getTestUtilsWebex();
    jest.clearAllMocks();

    mockMobiusSocket = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      sendWssRequest: jest.fn().mockResolvedValue({
        statusCode: 200,
        trackingId: 'test-tracking-id',
        data: {deviceId: 'test-device-id'},
      }),
      isConnected: jest.fn().mockReturnValue(false),
      getConnectedWebSocketUrl: jest.fn().mockReturnValue('wss://test.webex.com'),
      on: jest.fn(),
      off: jest.fn(),
    };

    mockMetricManager = {
      submitMobiusSocketMetric: jest.fn(),
    };

    (getMobiusSocketInstance as jest.Mock).mockReturnValue(mockMobiusSocket);
    (getMetricManager as jest.Mock).mockReturnValue(mockMetricManager);
    (isMobiusWssEnabled as jest.Mock).mockReturnValue(false);
    (uuid as jest.Mock).mockReturnValue('mock-uuid-12345');

    infoSpy = jest.spyOn(log, 'info');
    logSpy = jest.spyOn(log, 'log');
    warnSpy = jest.spyOn(log, 'warn');
    errorSpy = jest.spyOn(log, 'error');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and singleton pattern', () => {
    it('should create instance with webex config and HTTP transport', () => {
      const apiRequest = APIRequest.getInstance({webex});

      expect(apiRequest).toBeDefined();
      expect(getMobiusSocketInstance).toHaveBeenCalledWith(webex);
      expect(getMetricManager).toHaveBeenCalledWith(webex);
      expect(isMobiusWssEnabled).toHaveBeenCalledWith(webex);
      expect(infoSpy).toHaveBeenCalledWith('APIRequest initialized with transport: HTTP', {
        file: 'REQUEST',
        method: 'constructor',
      });
    });

    it('should create instance with webex config and WSS transport when feature flag enabled', () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(true);

      const apiRequest = APIRequest.getInstance({webex});

      expect(apiRequest).toBeDefined();
      expect(infoSpy).toHaveBeenCalledWith('APIRequest initialized with transport: WSS', {
        file: 'REQUEST',
        method: 'constructor',
      });
    });

    it('should throw error if webex is missing from config', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        APIRequest.getInstance({webex: undefined as any});
      }).toThrow('WebexSDK instance is required');

      expect(errorSpy).toHaveBeenCalledWith(
        'APIRequest instantiation failed: WebexSDK instance is required',
        {
          file: 'REQUEST',
          method: 'constructor',
        }
      );
    });

    it('should return same instance on subsequent getInstance() calls', () => {
      const instance1 = APIRequest.getInstance({webex});
      const instance2 = APIRequest.getInstance({webex});

      expect(instance1).toBe(instance2);
    });

    it('should clear singleton when resetInstance() is called', () => {
      const instance1 = APIRequest.getInstance({webex});

      APIRequest.resetInstance();

      const instance2 = APIRequest.getInstance({webex});

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createAPIRequest factory', () => {
    it('should create APIRequest instance using factory function', () => {
      const apiRequest = createAPIRequest({webex});

      expect(apiRequest).toBeDefined();
      expect(apiRequest).toBeInstanceOf(APIRequest);
    });
  });

  describe('isSocketEnabled', () => {
    it('should return false when WSS is disabled', () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});

      const result = apiRequest.isSocketEnabled();

      expect(result).toBe(false);
    });

    it('should return true when WSS is enabled', () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(true);
      const apiRequest = APIRequest.getInstance({webex});

      const result = apiRequest.isSocketEnabled();

      expect(result).toBe(true);
    });
  });

  describe('setSocketEnabled', () => {
    it.each([
      [true, 'WSS'],
      [false, 'HTTP'],
    ])('overrides the active transport to %s and logs it', (enabled, transport) => {
      const apiRequest = APIRequest.getInstance({webex});

      apiRequest.setSocketEnabled(enabled);

      expect(apiRequest.isSocketEnabled()).toBe(enabled);
      expect(infoSpy).toHaveBeenCalledWith(`APIRequest transport set to: ${transport}`, {
        file: 'REQUEST',
        method: 'setSocketEnabled',
      });
    });

    it('can flip the feature-flag seeded transport from WSS to HTTP', () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(true);
      const apiRequest = APIRequest.getInstance({webex});
      expect(apiRequest.isSocketEnabled()).toBe(true);

      apiRequest.setSocketEnabled(false);

      expect(apiRequest.isSocketEnabled()).toBe(false);
    });

    it('can flip the feature-flag seeded transport from HTTP to WSS', () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});
      expect(apiRequest.isSocketEnabled()).toBe(false);

      apiRequest.setSocketEnabled(true);

      expect(apiRequest.isSocketEnabled()).toBe(true);
    });
  });

  describe('isSocketConnected', () => {
    it.each([true, false])(
      'should delegate to the Mobius socket isConnected() and return %s',
      (connected) => {
        mockMobiusSocket.isConnected.mockReturnValue(connected);
        const apiRequest = APIRequest.getInstance({webex});

        expect(apiRequest.isSocketConnected()).toBe(connected);
        expect(mockMobiusSocket.isConnected).toHaveBeenCalled();
      }
    );
  });

  describe('connectToMobiusSocket', () => {
    it('should return immediately if socket is already connected', async () => {
      mockMobiusSocket.isConnected.mockReturnValue(true);
      mockMobiusSocket.getConnectedWebSocketUrl.mockReturnValue('wss://existing.webex.com');
      const apiRequest = APIRequest.getInstance({webex});

      const result = await apiRequest.connectToMobiusSocket('wss://test.webex.com');

      expect(result).toBe('wss://existing.webex.com');
      expect(mockMobiusSocket.connect).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith('Mobius WebSocket already connected', {
        file: 'REQUEST',
        method: 'connectToMobiusSocket',
      });
      expect(mockMetricManager.submitMobiusSocketMetric).not.toHaveBeenCalled();
    });

    it('should initiate new connection if not connected', async () => {
      mockMobiusSocket.isConnected.mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});
      const wssUrl = 'wss://test.webex.com/api/v1';

      const result = await apiRequest.connectToMobiusSocket(wssUrl);

      expect(mockMobiusSocket.connect).toHaveBeenCalledWith(wssUrl);
      expect(result).toBe(wssUrl);
      expect(infoSpy).toHaveBeenCalledWith(
        'Mobius WebSocket not connected, initiating connection',
        {
          file: 'REQUEST',
          method: 'connectToMobiusSocket',
        }
      );
    });

    it('should submit success metric on successful connection', async () => {
      mockMobiusSocket.isConnected.mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});
      const wssUrl = 'wss://mobius.webex.com/api/v1';

      await apiRequest.connectToMobiusSocket(wssUrl);

      expect(logSpy).toHaveBeenCalledWith('Mobius WebSocket connected successfully', {
        file: 'REQUEST',
        method: 'connectToMobiusSocket',
      });
      expect(mockMetricManager.submitMobiusSocketMetric).toHaveBeenCalledWith(
        METRIC_EVENT.MOBIUS_SOCKET,
        MOBIUS_SOCKET_ACTION.CONNECT,
        METRIC_TYPE.BEHAVIORAL,
        wssUrl
      );
    });

    it('should throw normalized error on connection failure', async () => {
      const connectionError = {
        statusCode: 503,
        statusMessage: 'Service Unavailable',
        trackingId: 'error-tracking-id',
        response: {
          statusCode: 503,
          trackingId: 'error-tracking-id',
          data: {error: 'Connection failed'},
          metadata: {'x-error': 'true'},
        },
      };
      mockMobiusSocket.isConnected.mockReturnValue(false);
      mockMobiusSocket.connect.mockRejectedValue(connectionError);
      const apiRequest = APIRequest.getInstance({webex});
      const wssUrl = 'wss://mobius.webex.com/api/v1';

      await expect(apiRequest.connectToMobiusSocket(wssUrl)).rejects.toEqual({
        statusCode: 503,
        body: {error: 'Connection failed'},
        headers: {
          trackingid: 'error-tracking-id',
          'x-error': 'true',
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mobius WebSocket connection failed'),
        {
          file: 'REQUEST',
          method: 'connectToMobiusSocket',
        }
      );
      expect(mockMetricManager.submitMobiusSocketMetric).toHaveBeenCalledWith(
        METRIC_EVENT.MOBIUS_SOCKET_ERROR,
        MOBIUS_SOCKET_ACTION.CONNECT,
        METRIC_TYPE.BEHAVIORAL,
        wssUrl,
        undefined,
        expect.any(String)
      );
    });

    it('should handle connection error with minimal error object', async () => {
      const minimalError = {statusCode: 500};
      mockMobiusSocket.isConnected.mockReturnValue(false);
      mockMobiusSocket.connect.mockRejectedValue(minimalError);
      const apiRequest = APIRequest.getInstance({webex});

      await expect(apiRequest.connectToMobiusSocket('wss://test.webex.com')).rejects.toEqual({
        statusCode: 500,
        body: undefined,
        headers: {
          trackingid: '',
        },
      });
    });
  });

  describe('disconnectFromMobiusSocket', () => {
    it('should disconnect successfully', async () => {
      const apiRequest = APIRequest.getInstance({webex});

      await apiRequest.disconnectFromMobiusSocket();

      expect(mockMobiusSocket.disconnect).toHaveBeenCalledWith(undefined);
      expect(infoSpy).toHaveBeenCalledWith('Disconnecting from Mobius WebSocket', {
        file: 'REQUEST',
        method: 'disconnectFromMobiusSocket',
      });
      expect(logSpy).toHaveBeenCalledWith('Mobius WebSocket disconnected successfully', {
        file: 'REQUEST',
        method: 'disconnectFromMobiusSocket',
      });
    });

    it('should submit success metric after disconnect', async () => {
      const apiRequest = APIRequest.getInstance({webex});

      await apiRequest.disconnectFromMobiusSocket();

      expect(mockMetricManager.submitMobiusSocketMetric).toHaveBeenCalledWith(
        METRIC_EVENT.MOBIUS_SOCKET,
        MOBIUS_SOCKET_ACTION.DISCONNECT,
        METRIC_TYPE.BEHAVIORAL,
        'wss://test.webex.com'
      );
    });

    it('should disconnect with custom options', async () => {
      const apiRequest = APIRequest.getInstance({webex});
      const options = {code: 1000, reason: 'Normal closure'};

      await apiRequest.disconnectFromMobiusSocket(options);

      expect(mockMobiusSocket.disconnect).toHaveBeenCalledWith(options);
    });

    it('should handle disconnect error silently and log warning', async () => {
      mockMobiusSocket.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      const apiRequest = APIRequest.getInstance({webex});

      await expect(apiRequest.disconnectFromMobiusSocket()).resolves.not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        'Mobius WebSocket disconnection failed: Error: Disconnect failed',
        {
          file: 'REQUEST',
          method: 'disconnectFromMobiusSocket',
        }
      );
    });

    it('should submit error metric on disconnect failure', async () => {
      mockMobiusSocket.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      const apiRequest = APIRequest.getInstance({webex});

      await apiRequest.disconnectFromMobiusSocket();

      expect(mockMetricManager.submitMobiusSocketMetric).toHaveBeenCalledWith(
        METRIC_EVENT.MOBIUS_SOCKET_ERROR,
        MOBIUS_SOCKET_ACTION.DISCONNECT,
        METRIC_TYPE.BEHAVIORAL,
        'wss://test.webex.com',
        undefined,
        'Error: Disconnect failed'
      );
    });
  });

  describe('makeRequest - HTTP transport', () => {
    it('should route through webex.request when WSS is disabled', async () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/device',
        method: HTTP_METHODS.POST,
        body: {userId: 'user-123'},
      };
      const expectedResponse: WebexRequestPayload = {
        statusCode: 200,
        body: {deviceId: 'device-456'},
      };
      webex.request.mockResolvedValue(expectedResponse);

      const result = await apiRequest.makeRequest(requestOptions);

      expect(webex.request).toHaveBeenCalledWith(requestOptions);
      expect(result).toEqual(expectedResponse);
      expect(infoSpy).toHaveBeenCalledWith('Dispatching request via HTTP ', {
        file: 'REQUEST',
        method: 'makeRequest',
      });
    });

    it('should pass request options unchanged to webex.request', async () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/devices/device-123',
        method: HTTP_METHODS.GET,
        headers: {'x-custom-header': 'value'},
      };
      webex.request.mockResolvedValue({statusCode: 200});

      await apiRequest.makeRequest(requestOptions);

      expect(webex.request).toHaveBeenCalledWith(requestOptions);
    });

    it('should return webex.request result directly', async () => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(false);
      const apiRequest = APIRequest.getInstance({webex});
      const expectedResponse = {
        statusCode: 404,
        body: {error: 'Not found'},
        headers: {'x-tracking-id': 'track-123'},
      };
      webex.request.mockResolvedValue(expectedResponse);

      const result = await apiRequest.makeRequest({
        uri: '/api/v1/test',
        method: HTTP_METHODS.GET,
      });

      expect(result).toEqual(expectedResponse);
    });
  });

  describe('makeRequest - WebSocket transport', () => {
    beforeEach(() => {
      (isMobiusWssEnabled as jest.Mock).mockReturnValue(true);
    });

    it('should derive socket message type from URI and method', async () => {
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/device',
        method: HTTP_METHODS.POST,
        body: {userId: 'user-123'},
      };

      await apiRequest.makeRequest(requestOptions);

      expect(mockMobiusSocket.sendWssRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MOBIUS_SOCKET_MESSAGE_TYPE.REGISTER,
        })
      );
      expect(infoSpy).toHaveBeenCalledWith('Dispatching request via WSS ', {
        file: 'REQUEST',
        method: 'makeRequest',
      });
    });

    it('should throw error if message type is UNKNOWN', async () => {
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/unrecognized/path',
        method: HTTP_METHODS.POST,
      };

      await expect(apiRequest.makeRequest(requestOptions)).rejects.toThrow(
        'Unknown Mobius Socket message type: UNKNOWN'
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown Mobius Socket message type'),
        {
          file: 'REQUEST',
          method: 'makeRequest',
        }
      );
    });

    it('should generate tracking ID with webex-js-sdk prefix', async () => {
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/device',
        method: HTTP_METHODS.POST,
      };

      await apiRequest.makeRequest(requestOptions);

      expect(uuid).toHaveBeenCalled();
      expect(mockMobiusSocket.sendWssRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingId: 'webex-js-sdk_mock-uuid-12345',
        })
      );
    });

    it('should send WSS request with correct payload structure', async () => {
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/device',
        method: HTTP_METHODS.POST,
        body: {userId: 'user-123'},
        headers: {'x-custom': 'header-value'},
      };

      await apiRequest.makeRequest(requestOptions);

      expect(mockMobiusSocket.sendWssRequest).toHaveBeenCalledWith({
        type: MOBIUS_SOCKET_MESSAGE_TYPE.REGISTER,
        trackingId: 'webex-js-sdk_mock-uuid-12345',
        metadata: {
          'x-custom': 'header-value',
          userAgent: 'webex-calling/beta',
          authorization: '',
        },
        data: {userId: 'user-123'},
      });
    });

    it('should get user token for supplementary services (CALL_HOLD)', async () => {
      webex.credentials.getUserToken.mockResolvedValue('Bearer token-abc-123');
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/devices/device-123/services/callhold/hold',
        method: HTTP_METHODS.POST,
      };

      await apiRequest.makeRequest(requestOptions);

      expect(webex.credentials.getUserToken).toHaveBeenCalled();
      expect(mockMobiusSocket.sendWssRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MOBIUS_SOCKET_MESSAGE_TYPE.CALL_HOLD,
          metadata: expect.objectContaining({
            authorization: 'Bearer token-abc-123',
          }),
        })
      );
    });

    it('should not get user token for non-supplementary services', async () => {
      const apiRequest = APIRequest.getInstance({webex});
      const requestOptions = {
        uri: '/api/v1/calling/web/device',
        method: HTTP_METHODS.POST,
      };

      await apiRequest.makeRequest(requestOptions);

      expect(webex.credentials.getUserToken).not.toHaveBeenCalled();
      expect(mockMobiusSocket.sendWssRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: '',
          }),
        })
      );
    });

    it('should normalize success response to WebexRequestPayload shape', async () => {
      const wsResponse: MobiusSocketResponse = {
        type: 'register.response',
        statusCode: 201,
        statusMessage: 'Created',
        trackingId: 'track-123',
        data: {deviceId: 'device-456', correlationId: 'corr-789'},
        metadata: {'x-response-header': 'value'},
      };
      mockMobiusSocket.sendWssRequest.mockResolvedValue(wsResponse);
      const apiRequest = APIRequest.getInstance({webex});

      const result = await apiRequest.makeRequest({
        uri: '/api/v1/calling/web/device',
        method: HTTP_METHODS.POST,
      });

      expect(result).toEqual({
        statusCode: 201,
        body: {deviceId: 'device-456', correlationId: 'corr-789'},
        headers: {
          trackingid: 'track-123',
          'x-response-header': 'value',
        },
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('WSS request succeeded'), {
        file: 'REQUEST',
        method: 'makeRequest',
      });
    });

    it('should normalize error to WebexRequestPayload shape', async () => {
      const wsError = {
        statusCode: 400,
        statusMessage: 'Bad Request',
        trackingId: 'error-track-456',
        response: {
          statusCode: 400,
          trackingId: 'error-track-456',
          data: {error: 'Invalid request'},
          metadata: {'x-error-code': 'ERR001'},
        },
      };
      mockMobiusSocket.sendWssRequest.mockRejectedValue(wsError);
      const apiRequest = APIRequest.getInstance({webex});

      await expect(
        apiRequest.makeRequest({
          uri: '/api/v1/calling/web/device',
          method: HTTP_METHODS.POST,
        })
      ).rejects.toEqual({
        statusCode: 400,
        body: {error: 'Invalid request'},
        headers: {
          trackingid: 'error-track-456',
          'x-error-code': 'ERR001',
        },
      });

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('WSS request failed'), {
        file: 'REQUEST',
        method: 'makeRequest',
      });
    });
  });

  describe('registerMobiusSocketListener', () => {
    it('should attach listener to event:async_event', () => {
      const apiRequest = APIRequest.getInstance({webex});
      const callback = jest.fn();

      apiRequest.registerMobiusSocketListener(callback);

      expect(mockMobiusSocket.on).toHaveBeenCalledWith('event:async_event', expect.any(Function));
      expect(infoSpy).toHaveBeenCalledWith('Attaching Mobius async event listener', {
        file: 'REQUEST',
        method: 'registerMobiusSocketListener',
      });
      expect(logSpy).toHaveBeenCalledWith('Mobius async event listener attached', {
        file: 'REQUEST',
        method: 'registerMobiusSocketListener',
      });
    });

    it('should invoke callback with event data when async event received', () => {
      const apiRequest = APIRequest.getInstance({webex});
      const callback = jest.fn();
      const mockEvent: MobiusAsyncEvent = {
        type: 'event:async_event',
        eventId: 'evt-123',
        trackingId: 'track-456',
        data: {
          eventType: 'registration.down',
        } as any,
      };

      apiRequest.registerMobiusSocketListener(callback);

      const attachedCallback = mockMobiusSocket.on.mock.calls[0][1];
      attachedCallback(mockEvent);

      expect(callback).toHaveBeenCalledWith(mockEvent);
    });

    it('should submit LISTENER_REGISTERED metric', () => {
      const apiRequest = APIRequest.getInstance({webex});
      const callback = jest.fn();

      apiRequest.registerMobiusSocketListener(callback);

      expect(mockMetricManager.submitMobiusSocketMetric).toHaveBeenCalledWith(
        METRIC_EVENT.MOBIUS_SOCKET,
        MOBIUS_SOCKET_ACTION.LISTENER_REGISTERED,
        METRIC_TYPE.BEHAVIORAL
      );
    });
  });

  describe('unregisterMobiusSocketListener', () => {
    it('should detach listener from event:async_event', () => {
      const apiRequest = APIRequest.getInstance({webex});

      apiRequest.unregisterMobiusSocketListener();

      expect(mockMobiusSocket.off).toHaveBeenCalledWith('event:async_event');
      expect(infoSpy).toHaveBeenCalledWith('Detaching Mobius async event listener', {
        file: 'REQUEST',
        method: 'unregisterMobiusSocketListener',
      });
      expect(logSpy).toHaveBeenCalledWith('Mobius async event listener detached', {
        file: 'REQUEST',
        method: 'unregisterMobiusSocketListener',
      });
    });

    it('should submit LISTENER_UNREGISTERED metric', () => {
      const apiRequest = APIRequest.getInstance({webex});

      apiRequest.unregisterMobiusSocketListener();

      expect(mockMetricManager.submitMobiusSocketMetric).toHaveBeenCalledWith(
        METRIC_EVENT.MOBIUS_SOCKET,
        MOBIUS_SOCKET_ACTION.LISTENER_UNREGISTERED,
        METRIC_TYPE.BEHAVIORAL
      );
    });
  });

  describe('registerMobiusSocketConnectionListener', () => {
    const getHandlerFor = (eventName: string): ((...args: unknown[]) => void) => {
      const call = mockMobiusSocket.on.mock.calls.find(([name]: [string]) => name === eventName);

      return call[1];
    };

    it('should attach listeners to online and offline.* socket events', () => {
      const apiRequest = APIRequest.getInstance({webex});

      apiRequest.registerMobiusSocketConnectionListener({
        onConnected: jest.fn(),
        onDisconnected: jest.fn(),
      });

      expect(mockMobiusSocket.on).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockMobiusSocket.on).toHaveBeenCalledWith('offline.permanent', expect.any(Function));
      expect(mockMobiusSocket.on).toHaveBeenCalledWith('offline.transient', expect.any(Function));
      expect(mockMobiusSocket.on).toHaveBeenCalledWith('offline.replaced', expect.any(Function));
      expect(infoSpy).toHaveBeenCalledWith('Attaching Mobius socket connection listener', {
        file: 'REQUEST',
        method: 'registerMobiusSocketConnectionListener',
      });
      expect(logSpy).toHaveBeenCalledWith('Mobius socket connection listener attached', {
        file: 'REQUEST',
        method: 'registerMobiusSocketConnectionListener',
      });
    });

    it('should invoke onConnected when the online event fires', () => {
      const apiRequest = APIRequest.getInstance({webex});
      const onConnected = jest.fn();

      apiRequest.registerMobiusSocketConnectionListener({
        onConnected,
        onDisconnected: jest.fn(),
      });

      getHandlerFor('online')();

      expect(onConnected).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['offline.permanent', MOBIUS_SOCKET_DISCONNECT_REASON.PERMANENT],
      ['offline.transient', MOBIUS_SOCKET_DISCONNECT_REASON.TRANSIENT],
      ['offline.replaced', MOBIUS_SOCKET_DISCONNECT_REASON.REPLACED],
    ])('should invoke onDisconnected with %s reason when %s fires', (eventName, reason) => {
      const apiRequest = APIRequest.getInstance({webex});
      const onDisconnected = jest.fn();

      apiRequest.registerMobiusSocketConnectionListener({
        onConnected: jest.fn(),
        onDisconnected,
      });

      getHandlerFor(eventName as string)();

      expect(onDisconnected).toHaveBeenCalledTimes(1);
      expect(onDisconnected).toHaveBeenCalledWith(reason);
    });
  });

  describe('unregisterMobiusSocketConnectionListener', () => {
    it('should detach listeners from online and offline.* socket events', () => {
      const apiRequest = APIRequest.getInstance({webex});

      apiRequest.unregisterMobiusSocketConnectionListener();

      expect(mockMobiusSocket.off).toHaveBeenCalledWith('online');
      expect(mockMobiusSocket.off).toHaveBeenCalledWith('offline.permanent');
      expect(mockMobiusSocket.off).toHaveBeenCalledWith('offline.transient');
      expect(mockMobiusSocket.off).toHaveBeenCalledWith('offline.replaced');
      expect(infoSpy).toHaveBeenCalledWith('Detaching Mobius socket connection listener', {
        file: 'REQUEST',
        method: 'unregisterMobiusSocketConnectionListener',
      });
      expect(logSpy).toHaveBeenCalledWith('Mobius socket connection listener detached', {
        file: 'REQUEST',
        method: 'unregisterMobiusSocketConnectionListener',
      });
    });
  });
});

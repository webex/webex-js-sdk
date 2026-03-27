import CallingTransport from './index';
import LegacyMercuryTransportAdapter from './LegacyMercuryTransportAdapter';
import SDKConnector from '../SDKConnector';
import {WebexRequestPayload} from '../common/types';
import {WebexSDK} from '../SDKConnector/types';
import {
  ICallingTransportAdapter,
  CallingTransportEventHandler,
  CallingTransportConnectionSource,
  CallingTransportConnectionState,
} from './types';

jest.mock('../SDKConnector', () => ({
  __esModule: true,
  default: {
    getWebex: jest.fn(),
  },
}));

describe('CallingTransport', () => {
  const createWebex = () =>
    ({
      request: jest.fn(),
      internal: {
        mercury: {
          on: jest.fn(),
          off: jest.fn(),
        },
      },
    } as unknown as WebexSDK);

  afterEach(() => {
    CallingTransport.setAdapter(new LegacyMercuryTransportAdapter());
    (SDKConnector.getWebex as jest.Mock).mockReset();
    jest.clearAllMocks();
  });

  it('delegates requests to the legacy adapter using the configured webex instance', async () => {
    const webex = createWebex();
    const request = {uri: 'https://example.test'} as WebexRequestPayload;
    const response = {statusCode: 200};

    webex.request = jest.fn().mockResolvedValue(response);
    (SDKConnector.getWebex as jest.Mock).mockReturnValue(webex);

    await expect(CallingTransport.request(request)).resolves.toBe(response);
    expect(webex.request).toHaveBeenCalledWith(request);
  });

  it('delegates listener registration and removal to mercury by default', () => {
    const webex = createWebex();
    const handler = jest.fn();

    (SDKConnector.getWebex as jest.Mock).mockReturnValue(webex);
    CallingTransport.on('event:mobius', handler);
    CallingTransport.off('event:mobius');
    CallingTransport.off('event:mobius', handler);

    expect(webex.internal.mercury.on).toHaveBeenCalledWith('event:mobius', handler);
    expect(webex.internal.mercury.off).toHaveBeenCalledWith('event:mobius');
    expect(webex.internal.mercury.off).toHaveBeenCalledWith('event:mobius', handler);
  });

  it('allows adapter replacement without changing callers', async () => {
    const webex = createWebex();
    const request = {uri: 'https://example.test'} as WebexRequestPayload;
    const response = {statusCode: 202};
    const handler = jest.fn();
    const customAdapter: ICallingTransportAdapter = {
      request: jest.fn().mockResolvedValue(response),
      on: jest.fn(),
      off: jest.fn(),
      onConnectionStateChange: jest.fn(),
      offConnectionStateChange: jest.fn(),
    };

    (SDKConnector.getWebex as jest.Mock).mockReturnValue(webex);
    CallingTransport.setAdapter(customAdapter);

    await expect(CallingTransport.request(request)).resolves.toBe(response);
    CallingTransport.on('event:mobius', handler as CallingTransportEventHandler<unknown>);
    CallingTransport.off('event:mobius');
    CallingTransport.off('event:mobius', handler as CallingTransportEventHandler<unknown>);

    expect(customAdapter.request).toHaveBeenCalledWith(webex, request);
    expect(customAdapter.on).toHaveBeenCalledWith(webex, 'event:mobius', handler);
    expect(customAdapter.off).toHaveBeenCalledWith(webex, 'event:mobius', undefined);
    expect(customAdapter.off).toHaveBeenCalledWith(webex, 'event:mobius', handler);
  });

  it('disposes the previous adapter when the transport adapter changes', () => {
    const webex = createWebex();
    const firstAdapter: ICallingTransportAdapter = {
      request: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      dispose: jest.fn(),
      onConnectionStateChange: jest.fn(),
      offConnectionStateChange: jest.fn(),
    };
    const secondAdapter: ICallingTransportAdapter = {
      request: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      onConnectionStateChange: jest.fn(),
      offConnectionStateChange: jest.fn(),
    };

    (SDKConnector.getWebex as jest.Mock).mockReturnValue(webex);

    CallingTransport.setAdapter(firstAdapter);
    CallingTransport.setAdapter(secondAdapter);

    expect(firstAdapter.dispose).toHaveBeenCalledWith(webex);
  });

  it('maps legacy mercury connectivity events to transport connection state changes', () => {
    const webex = createWebex();
    const handler = jest.fn();

    (SDKConnector.getWebex as jest.Mock).mockReturnValue(webex);
    CallingTransport.onConnectionStateChange(handler);

    const mercuryOfflineHandler = (webex.internal.mercury.on as jest.Mock).mock.calls.find(
      ([event]) => event === 'offline'
    )?.[1];
    const mercuryOnlineHandler = (webex.internal.mercury.on as jest.Mock).mock.calls.find(
      ([event]) => event === 'online'
    )?.[1];

    mercuryOfflineHandler();
    mercuryOnlineHandler();

    expect(handler).toHaveBeenNthCalledWith(1, {
      source: CallingTransportConnectionSource.MERCURY,
      state: CallingTransportConnectionState.OFFLINE,
    });
    expect(handler).toHaveBeenNthCalledWith(2, {
      source: CallingTransportConnectionSource.MERCURY,
      state: CallingTransportConnectionState.ONLINE,
    });
  });

  it('unregisters mercury listeners on offConnectionStateChange', () => {
    const webex = createWebex();
    const handler = jest.fn();

    (SDKConnector.getWebex as jest.Mock).mockReturnValue(webex);

    CallingTransport.onConnectionStateChange(handler);
    CallingTransport.offConnectionStateChange();

    expect(webex.internal.mercury.off).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(webex.internal.mercury.off).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('fails fast when SDKConnector has no webex instance', () => {
    (SDKConnector.getWebex as jest.Mock).mockReturnValue(undefined);

    expect(() =>
      CallingTransport.request({uri: 'https://example.test'} as WebexRequestPayload)
    ).toThrow('CallingTransport requires SDKConnector webex instance');
  });
});

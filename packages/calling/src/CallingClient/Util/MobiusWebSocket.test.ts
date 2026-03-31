import MobiusWebSocket, {DEFAULT_MOBIUS_WEBSOCKET_SESSION} from './MobiusWebSocket';

type MercuryTestHarness = {
  setSocket: (sessionId: string, socket: {connected: boolean; send: jest.Mock}) => void;
};

jest.mock('@webex/internal-plugin-mercury', () => {
  class MercuryMock {
    private sockets = new Map<string, {connected: boolean; send: jest.Mock}>();

    public connect = jest.fn().mockResolvedValue(undefined);

    public disconnect = jest.fn().mockResolvedValue(undefined);

    public on = jest.fn();

    public off = jest.fn();

    public getSocket = jest.fn((sessionId: string) => this.sockets.get(sessionId));

    public setSocket(sessionId: string, socket: {connected: boolean; send: jest.Mock}) {
      this.sockets.set(sessionId, socket);
    }
  }

  return {
    __esModule: true,
    default: MercuryMock,
  };
});

describe('MobiusWebSocket', () => {
  let mobiusWebSocket: MobiusWebSocket;

  beforeEach(() => {
    mobiusWebSocket = new MobiusWebSocket();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('connects through Mercury', async () => {
    await mobiusWebSocket.connectToMobius('wss://mobius.example.com/socket');

    expect(mobiusWebSocket.connect).toHaveBeenCalledWith(
      'wss://mobius.example.com/socket',
      DEFAULT_MOBIUS_WEBSOCKET_SESSION
    );
  });

  it('disconnects through Mercury', async () => {
    await mobiusWebSocket.disconnectFromMobius('session-1');

    expect(mobiusWebSocket.disconnect).toHaveBeenCalledWith(undefined, 'session-1');
  });

  it('subscribes to generic Mobius events for the default session', () => {
    const listener = jest.fn();

    mobiusWebSocket.onMobiusEvent(listener);

    expect(mobiusWebSocket.on).toHaveBeenCalledWith('event', listener);
  });

  it('subscribes to a typed event for a scoped session', () => {
    const listener = jest.fn();

    mobiusWebSocket.onEventType('mobius.call', listener, 'session-2');

    expect(mobiusWebSocket.on).toHaveBeenCalledWith('event:mobius.call:session-2', listener);
  });

  it('unsubscribes from generic and typed events', () => {
    const listener = jest.fn();

    mobiusWebSocket.offMobiusEvent(listener);
    mobiusWebSocket.offEventType('mobius.call', listener, 'session-3');

    expect(mobiusWebSocket.off).toHaveBeenNthCalledWith(1, 'event', listener);
    expect(mobiusWebSocket.off).toHaveBeenNthCalledWith(2, 'event:mobius.call:session-3', listener);
  });

  it('sends payload on the active connected socket', async () => {
    const send = jest.fn().mockResolvedValue(undefined);

    (mobiusWebSocket as unknown as MercuryTestHarness).setSocket(DEFAULT_MOBIUS_WEBSOCKET_SESSION, {
      connected: true,
      send,
    });

    await mobiusWebSocket.sendEvent({type: 'ack'});

    expect(send).toHaveBeenCalledWith({type: 'ack'});
  });

  it('throws when sending without an active connected socket', async () => {
    await expect(mobiusWebSocket.sendEvent({type: 'ack'})).rejects.toThrow(
      'Mobius socket is not connected for session mobius-websocket-session'
    );
  });

  it('reports socket connection state', () => {
    (mobiusWebSocket as unknown as MercuryTestHarness).setSocket('connected-session', {
      connected: true,
      send: jest.fn(),
    });
    (mobiusWebSocket as unknown as MercuryTestHarness).setSocket('disconnected-session', {
      connected: false,
      send: jest.fn(),
    });

    expect(mobiusWebSocket.isConnected('connected-session')).toBe(true);
    expect(mobiusWebSocket.isConnected('disconnected-session')).toBe(false);
    expect(mobiusWebSocket.isConnected('missing-session')).toBe(false);
  });
});

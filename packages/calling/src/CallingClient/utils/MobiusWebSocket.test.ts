import MobiusWebSocket, {DEFAULT_MOBIUS_WEBSOCKET_SESSION} from './MobiusWebSocket';

type MercuryTestHarness = {
  setSocket: (sessionId: string, socket: {connected: boolean; send: jest.Mock}) => void;
  connectCalls: unknown[][];
  disconnectCalls: unknown[][];
  onCalls: unknown[][];
  offCalls: unknown[][];
};

jest.mock('@webex/internal-plugin-mercury', () => {
  class MercuryMock {
    private sockets = new Map<string, {connected: boolean; send: jest.Mock}>();

    public connectCalls: unknown[][] = [];

    public disconnectCalls: unknown[][] = [];

    public onCalls: unknown[][] = [];

    public offCalls: unknown[][] = [];

    public async connect(...args: unknown[]) {
      this.connectCalls.push(args);
    }

    public async disconnect(...args: unknown[]) {
      this.disconnectCalls.push(args);
    }

    public on(...args: unknown[]) {
      this.onCalls.push(args);
    }

    public off(...args: unknown[]) {
      this.offCalls.push(args);
    }

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
    await mobiusWebSocket.connect('wss://mobius.example.com/socket');

    expect((mobiusWebSocket as unknown as MercuryTestHarness).connectCalls).toEqual([
      ['wss://mobius.example.com/socket', DEFAULT_MOBIUS_WEBSOCKET_SESSION],
    ]);
  });

  it('disconnects through Mercury', async () => {
    await mobiusWebSocket.disconnect();

    expect((mobiusWebSocket as unknown as MercuryTestHarness).disconnectCalls).toEqual([
      [undefined, DEFAULT_MOBIUS_WEBSOCKET_SESSION],
    ]);
  });

  it('uses inherited Mercury on/off methods directly for event subscriptions', () => {
    const genericListener = jest.fn();

    mobiusWebSocket.on('event', genericListener);
    mobiusWebSocket.off('event', genericListener);

    expect((mobiusWebSocket as unknown as MercuryTestHarness).onCalls).toEqual([
      ['event', genericListener],
    ]);
    expect((mobiusWebSocket as unknown as MercuryTestHarness).offCalls).toEqual([
      ['event', genericListener],
    ]);
  });

  it('sends payload on the active connected socket', async () => {
    const send = jest.fn().mockResolvedValue(undefined);

    (mobiusWebSocket as unknown as MercuryTestHarness).setSocket(DEFAULT_MOBIUS_WEBSOCKET_SESSION, {
      connected: true,
      send,
    });

    await mobiusWebSocket.send({type: 'ack'});

    expect(send).toHaveBeenCalledWith({type: 'ack'});
  });

  it('throws when sending without an active connected socket', async () => {
    await expect(mobiusWebSocket.send({type: 'ack'})).rejects.toThrow(
      'Mobius socket is not connected for session mobius-websocket-session'
    );
  });

  it('reports socket connection state for the default session', () => {
    (mobiusWebSocket as unknown as MercuryTestHarness).setSocket(DEFAULT_MOBIUS_WEBSOCKET_SESSION, {
      connected: true,
      send: jest.fn(),
    });

    expect(mobiusWebSocket.isConnected()).toBe(true);
  });
});

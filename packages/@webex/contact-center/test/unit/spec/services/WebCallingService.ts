import 'jsdom-global/register';
import WebCallingService from '../../../../src/services/WebCallingService';
import {
  createClient,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  ERROR_TYPE,
  CALL_EVENT_KEYS,
  CALLING_CLIENT_EVENT_KEYS,
  LocalMicrophoneStream,
} from '@webex/calling';
import {VOICE_CONNECTION_STATUS, VoiceLineStatus, WebexSDK} from '../../../../src/types';
import {VOICE_CONNECTION_EVENTS} from '../../../../src/services/config/types';
import LoggerProxy from '../../../../src/logger-proxy';
import {TIMEOUT_DURATION, WEB_CALLING_SERVICE_FILE} from '../../../../src/constants';
import {METHODS} from '../../../../src/services/constants';
jest.mock('@webex/calling');

jest.mock('../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

describe('WebCallingService', () => {
  let webex: WebexSDK;
  let callingClient: ICallingClient;
  let line: ILine;
  let webRTCCalling: WebCallingService;
  let mockCall;

  const setBrowserVoiceRequired = () => {
    webRTCCalling.setLoginOption('BROWSER');
    webRTCCalling.setBrowserVoiceRequired(true);
  };

  const registerLineImmediately = (
    deviceInfo = {mobiusDeviceId: 'device123'},
    onEvent?: (event, handler) => void
  ) => {
    line = callingClient.getLines().line1 as ILine;
    return jest.spyOn(line, 'on').mockImplementation((event, handler) => {
      onEvent?.(event, handler);
      if (event === LINE_EVENTS.REGISTERED) {
        handler(deviceInfo);
      }
    });
  };

  const getHandler = (emitter, event) =>
    emitter.on.mock.calls.find(([registeredEvent]) => registeredEvent === event)?.[1];

  const createEmitter = () => {
    const handlers = new Map<string, Array<(...args: any[]) => void>>();
    const emitter = {
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      }),
      off: jest.fn((event: string, handler: (...args: any[]) => void) => {
        handlers.set(
          event,
          (handlers.get(event) ?? []).filter((registeredHandler) => registeredHandler !== handler)
        );
      }),
      emit: (event: string, ...args: any[]) => {
        (handlers.get(event) ?? []).forEach((handler) => handler(...args));
      },
      handlers,
    };

    return emitter;
  };

  beforeEach(() => {
    webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      internal: {
        services: {
          waitForCatalog: jest.fn().mockResolvedValue(undefined),
          get: jest.fn(),
        },
      },
    } as unknown as WebexSDK;

    callingClient = {
      getActiveCalls: jest.fn().mockReturnValue({}),
      on: jest.fn(),
      off: jest.fn(),
      isMobiusSocketConnected: jest.fn().mockReturnValue(false),
      getLines: jest.fn().mockReturnValue({
        line1: {
          on: jest.fn(),
          off: jest.fn(),
          register: jest.fn(),
          deregister: jest.fn(),
        },
      }),
    } as unknown as ICallingClient;

    (createClient as jest.Mock).mockResolvedValue(callingClient);

    webRTCCalling = new WebCallingService(webex);

    mockCall = {
      on: jest.fn(),
      off: jest.fn(),
      answer: jest.fn(),
      mute: jest.fn(),
      isMuted: jest.fn().mockReturnValue(true),
      end: jest.fn(),
      getCallId: jest.fn().mockReturnValue('call-id-123'),
    };

    // Set the private call property through type assertion for testing
    (webRTCCalling as any).call = mockCall;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  describe('registerWebCallingLine', () => {
    it('should not require browser voice until local registration is enabled', () => {
      webRTCCalling.setLoginOption('BROWSER');

      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.NOT_REQUIRED,
        lineStatus: 'unknown',
        mobiusSocketStatus: 'unknown',
      });

      webRTCCalling.setBrowserVoiceRequired(true);

      expect(webRTCCalling.getVoiceConnectionState().status).toBe(
        VOICE_CONNECTION_STATUS.UNAVAILABLE
      );
    });

    it('should register the web calling line successfully', async () => {
      setBrowserVoiceRequired();
      webex.internal.services.get.mockReturnValue(undefined); // this is to test fallback to default rtms domain
      line = callingClient.getLines().line1 as ILine;
      const deviceInfo = {
        mobiusDeviceId: 'device123',
        status: 'registered',
        setError: jest.fn(),
        getError: jest.fn(),
        type: 'line',
        id: 'line1',
      };

      const lineOnSpy = registerLineImmediately(deviceInfo);

      await expect(webRTCCalling.registerWebCallingLine()).resolves.toBeUndefined();

      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.READY,
        lineStatus: 'registered',
        mobiusSocketStatus: 'not-in-use',
      });

      expect(createClient).toHaveBeenCalledWith(webex, {
        logger: {
          level: 'info',
        },
        serviceData: {
          indicator: 'contactcenter',
          domain: 'rtw.prod-us1.rtmsprod.net',
        },
      });
      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));
      expect(line.register).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`,
        {method: 'registerWebCallingLine', module: WEB_CALLING_SERVICE_FILE}
      );
    }, 20000); // Increased timeout to 20 seconds

    it('retires the previous registration before registering a new calling client', async () => {
      const firstLine = Object.assign(createEmitter(), {
        register: jest.fn(),
        deregister: jest.fn().mockResolvedValue(undefined),
      });
      const secondLine = Object.assign(createEmitter(), {
        register: jest.fn(),
        deregister: jest.fn().mockResolvedValue(undefined),
      });
      const firstClient = {
        ...createEmitter(),
        isMobiusSocketConnected: jest.fn().mockReturnValue(false),
        getLines: jest.fn().mockReturnValue({line1: firstLine}),
      };
      const secondClient = {
        ...createEmitter(),
        isMobiusSocketConnected: jest.fn().mockReturnValue(false),
        getLines: jest.fn().mockReturnValue({line1: secondLine}),
      };

      (createClient as jest.Mock)
        .mockResolvedValueOnce(firstClient)
        .mockResolvedValueOnce(secondClient);
      firstLine.register.mockImplementation(() =>
        firstLine.emit(LINE_EVENTS.REGISTERED, firstLine)
      );
      secondLine.register.mockImplementation(() =>
        secondLine.emit(LINE_EVENTS.REGISTERED, secondLine)
      );
      setBrowserVoiceRequired();

      await webRTCCalling.registerWebCallingLine();
      const staleRegisteredHandler = firstLine.handlers.get(LINE_EVENTS.REGISTERED)?.[0];
      await webRTCCalling.registerWebCallingLine();

      const currentState = webRTCCalling.getVoiceConnectionState();
      expect(firstLine.deregister).toHaveBeenCalledTimes(1);
      expect([...firstLine.handlers.values()].every((handlers) => handlers.length === 0)).toBe(
        true
      );
      expect([...firstClient.handlers.values()].every((handlers) => handlers.length === 0)).toBe(
        true
      );

      firstLine.emit(LINE_EVENTS.ERROR, {status: 'error', message: 'stale line error'});
      firstLine.emit(LINE_EVENTS.REGISTERED, firstLine);
      firstClient.emit(CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED, {reason: 'transient'});
      staleRegisteredHandler?.(firstLine);

      expect(webRTCCalling.getVoiceConnectionState()).toEqual(currentState);
      expect(secondLine.register).toHaveBeenCalledTimes(1);
    });

    it('ignores a register rejection after its line has been superseded', async () => {
      const firstLine = Object.assign(createEmitter(), {
        register: jest.fn(),
        deregister: jest.fn().mockResolvedValue(undefined),
      });
      const secondLine = Object.assign(createEmitter(), {
        register: jest.fn(),
        deregister: jest.fn().mockResolvedValue(undefined),
      });
      const firstClient = {
        ...createEmitter(),
        isMobiusSocketConnected: jest.fn().mockReturnValue(false),
        getLines: jest.fn().mockReturnValue({line1: firstLine}),
      };
      const secondClient = {
        ...createEmitter(),
        isMobiusSocketConnected: jest.fn().mockReturnValue(false),
        getLines: jest.fn().mockReturnValue({line1: secondLine}),
      };
      let registerStartedResolve = jest.fn();
      const registerStarted = new Promise<void>((resolve) => {
        registerStartedResolve = resolve;
      });
      let rejectFirstRegister = jest.fn();
      const firstRegisterPromise = new Promise<void>((_resolve, reject) => {
        rejectFirstRegister = reject;
      });

      (createClient as jest.Mock)
        .mockResolvedValueOnce(firstClient)
        .mockResolvedValueOnce(secondClient);
      firstLine.register.mockImplementation(() => {
        registerStartedResolve();

        return firstRegisterPromise;
      });
      secondLine.register.mockImplementation(() =>
        secondLine.emit(LINE_EVENTS.REGISTERED, secondLine)
      );
      setBrowserVoiceRequired();

      const firstRegistration = webRTCCalling.registerWebCallingLine();
      await registerStarted;
      await webRTCCalling.registerWebCallingLine();
      await firstRegistration;
      const currentState = webRTCCalling.getVoiceConnectionState();

      rejectFirstRegister(new Error('superseded registration failed'));
      await firstRegisterPromise.catch(() => undefined);

      expect(webRTCCalling.getVoiceConnectionState()).toEqual(currentState);
      expect(currentState.status).toBe(VOICE_CONNECTION_STATUS.READY);
    });

    it('should register WebCallingLine with custom rtms url', async () => {
      webex.internal.services.get.mockReturnValue('sip://rtw.prod-us2.rtmsprod.net');

      line = callingClient.getLines().line1 as ILine;
      const deviceInfo = {
        mobiusDeviceId: 'device123',
        status: 'registered',
        setError: jest.fn(),
        getError: jest.fn(),
        type: 'line',
        id: 'line1',
      };

      const lineOnSpy = registerLineImmediately(deviceInfo);
      await expect(webRTCCalling.registerWebCallingLine()).resolves.toBeUndefined();
      expect(createClient).toHaveBeenCalledWith(webex, {
        logger: {
          level: 'info',
        },
        serviceData: {
          indicator: 'contactcenter',
          domain: 'rtw.prod-us2.rtmsprod.net',
        },
      });
      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));
      expect(line.register).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`,
        {method: 'registerWebCallingLine', module: WEB_CALLING_SERVICE_FILE}
      );
    }, 20000); // Increased timeout to 20 seconds

    it('should handle error when invalid rtms url is provided', async () => {
      webex.internal.services.get.mockReturnValue('invalid-url');

      line = callingClient.getLines().line1 as ILine;
      const deviceInfo = {
        mobiusDeviceId: 'device123',
        status: 'registered',
        setError: jest.fn(),
        getError: jest.fn(),
        type: 'line',
        id: 'line1',
      };

      const lineOnSpy = registerLineImmediately(deviceInfo);
      await expect(webRTCCalling.registerWebCallingLine()).resolves.toBeUndefined();
      expect(createClient).toHaveBeenCalledWith(webex, {
        logger: {
          level: 'info',
        },
        serviceData: {
          indicator: 'contactcenter',
          domain: 'rtw.prod-us1.rtmsprod.net',
        },
      });
      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));
      expect(line.register).toHaveBeenCalled();
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `Invalid URL from u2c catalogue: invalid-url so falling back to default domain`,
        {module: WEB_CALLING_SERVICE_FILE, method: 'getRTMSDomain'}
      );
    });

    it('should fall back to default domain for a non-allow-listed catalog RTMS host', async () => {
      webex.internal.services.get.mockReturnValue('wss://evil.attacker.com');

      line = callingClient.getLines().line1 as ILine;
      const deviceInfo = {
        mobiusDeviceId: 'device123',
        status: 'registered',
        setError: jest.fn(),
        getError: jest.fn(),
        type: 'line',
        id: 'line1',
      };

      const lineOnSpy = registerLineImmediately(deviceInfo);
      await expect(webRTCCalling.registerWebCallingLine()).resolves.toBeUndefined();
      expect(createClient).toHaveBeenCalledWith(webex, {
        logger: {
          level: 'info',
        },
        serviceData: {
          indicator: 'contactcenter',
          domain: 'rtw.prod-us1.rtmsprod.net',
        },
      });
      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));
      expect(line.register).toHaveBeenCalled();
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'Non-allow-listed RTMS host from u2c catalogue: evil.attacker.com so falling back to default domain',
        {module: WEB_CALLING_SERVICE_FILE, method: 'getRTMSDomain'}
      );
    });

    it('should reject if registration times out', async () => {
      setBrowserVoiceRequired();
      line = callingClient.getLines().line1 as ILine;
      jest.useFakeTimers();
      let notifyRegistrationStarted: () => void;
      const registrationStarted = new Promise<void>((resolve) => {
        notifyRegistrationStarted = resolve;
      });
      line.register.mockImplementation(notifyRegistrationStarted);
      const promise = webRTCCalling.registerWebCallingLine();
      await registrationStarted;
      jest.advanceTimersByTime(TIMEOUT_DURATION);

      await expect(promise).rejects.toThrow('WebCallingService Registration timed out');
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'error',
        mobiusSocketStatus: 'not-in-use',
        reason: 'REGISTRATION_TIMEOUT',
        retryable: true,
      });
    });

    it('should report initial registration failure and reject registration', async () => {
      setBrowserVoiceRequired();
      line = callingClient.getLines().line1 as ILine;
      const error = new Error('Registration failed');
      line.register.mockRejectedValue(error);
      const registration = webRTCCalling.registerWebCallingLine();

      await expect(registration).rejects.toThrow('Registration failed');
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'error',
        mobiusSocketStatus: 'not-in-use',
        reason: 'Registration failed',
        retryable: false,
      });
    });

    it('keeps a Mobius disconnect reason separate from a line registration failure', async () => {
      setBrowserVoiceRequired();
      webRTCCalling['handleMobiusSocketDisconnected']({reason: 'transient'} as any);
      webex.internal.services.waitForCatalog.mockRejectedValue(new Error('Catalog unavailable'));

      await expect(webRTCCalling.registerWebCallingLine()).rejects.toThrow('Catalog unavailable');

      expect(webRTCCalling.getVoiceConnectionState()).toMatchObject({
        lineStatus: 'error',
        mobiusSocketStatus: 'disconnected',
        reason: 'MOBIUS_SOCKET_TRANSIENT',
        retryable: true,
      });

      webRTCCalling['handleMobiusSocketConnected']();

      expect(webRTCCalling.getVoiceConnectionState()).toMatchObject({
        lineStatus: 'error',
        mobiusSocketStatus: 'connected',
        reason: 'Catalog unavailable',
        retryable: false,
      });
    });

    it.each([
      ['transient', true],
      ['permanent', false],
      ['replaced', false],
    ])('should report Mobius socket %s with retryable=%s', async (reason, retryable) => {
      setBrowserVoiceRequired();
      registerLineImmediately();

      await webRTCCalling.registerWebCallingLine();
      const disconnectedHandler = getHandler(
        callingClient,
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED
      );

      disconnectedHandler({reason});

      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'registered',
        mobiusSocketStatus: 'disconnected',
        reason: `MOBIUS_SOCKET_${reason.toUpperCase()}`,
        retryable,
      });
    });

    it('should return to ready and emit an update after Mobius reconnects', async () => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      const stateChangeListener = jest.fn();
      webRTCCalling.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, stateChangeListener);

      await webRTCCalling.registerWebCallingLine();
      const disconnectedHandler = getHandler(
        callingClient,
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED
      );
      const connectedHandler = getHandler(
        callingClient,
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED
      );

      disconnectedHandler({reason: 'transient'});
      connectedHandler();

      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.READY,
        lineStatus: 'registered',
        mobiusSocketStatus: 'connected',
      });
      expect(stateChangeListener).toHaveBeenLastCalledWith(webRTCCalling.getVoiceConnectionState());
    });

    it('should update line reconnect and unregistration states', async () => {
      setBrowserVoiceRequired();
      registerLineImmediately();

      await webRTCCalling.registerWebCallingLine();
      const handlers = new Map(line.on.mock.calls.map(([event, handler]) => [event, handler]));
      handlers.get(LINE_EVENTS.RECONNECTING)();
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'reconnecting',
        mobiusSocketStatus: 'not-in-use',
        reason: 'LINE_RECONNECTING',
        retryable: true,
      });

      handlers.get(LINE_EVENTS.RECONNECTED)();
      expect(webRTCCalling.getVoiceConnectionState().status).toBe(VOICE_CONNECTION_STATUS.READY);

      handlers.get(LINE_EVENTS.UNREGISTERED)();
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'unregistered',
        mobiusSocketStatus: 'not-in-use',
        reason: 'LINE_UNREGISTERED',
        retryable: true,
      });
    });

    it('should clear line-level recovery details when registration starts connecting', async () => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      await webRTCCalling.registerWebCallingLine();
      const connectingHandler = getHandler(line, LINE_EVENTS.CONNECTING);

      connectingHandler();

      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'connecting',
        mobiusSocketStatus: 'not-in-use',
      });
    });

    it('should preserve the Mobius disconnect cause across keepalive recovery events', async () => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      await webRTCCalling.registerWebCallingLine();

      getHandler(
        callingClient,
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED
      )({reason: 'transient'});
      getHandler(line, LINE_EVENTS.RECONNECTED)();

      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'reconnected',
        mobiusSocketStatus: 'disconnected',
        reason: 'MOBIUS_SOCKET_TRANSIENT',
        retryable: true,
      });
    });

    it.each([
      ['active', VOICE_CONNECTION_STATUS.READY, 'registered', undefined],
      ['inactive', VOICE_CONNECTION_STATUS.UNAVAILABLE, 'error', 'Invalid number'],
    ])(
      'should map line errors with registration status %s',
      async (registrationStatus, status, lineStatus, reason) => {
        setBrowserVoiceRequired();
        registerLineImmediately();
        await webRTCCalling.registerWebCallingLine();
        getHandler(
          line,
          LINE_EVENTS.ERROR
        )({
          message: 'Invalid number',
          status: registrationStatus,
        });

        expect(webRTCCalling.getVoiceConnectionState()).toMatchObject({
          status,
          lineStatus,
          mobiusSocketStatus: 'not-in-use',
          ...(reason ? {reason, retryable: false} : {}),
        });
      }
    );

    it('keeps the REGISTERED listener active for subsequent registrations', async () => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      await webRTCCalling.registerWebCallingLine();
      const registeredHandler = getHandler(line, LINE_EVENTS.REGISTERED);

      getHandler(line, LINE_EVENTS.UNREGISTERED)();
      expect(webRTCCalling.getVoiceConnectionState().status).toBe(
        VOICE_CONNECTION_STATUS.UNAVAILABLE
      );

      registeredHandler({mobiusDeviceId: 'device123'});

      expect(webRTCCalling.getVoiceConnectionState().status).toBe(VOICE_CONNECTION_STATUS.READY);
    });

    it.each([
      LINE_EVENTS.CONNECTING,
      LINE_EVENTS.RECONNECTING,
      LINE_EVENTS.RECONNECTED,
      LINE_EVENTS.UNREGISTERED,
      LINE_EVENTS.ERROR,
      LINE_EVENTS.REGISTERED,
      LINE_EVENTS.INCOMING_CALL,
    ])('detaches the %s listener after deregistration', async (event) => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      await webRTCCalling.registerWebCallingLine();
      const handler = getHandler(line, event);

      await webRTCCalling.deregisterWebCallingLine();

      expect(line.off).toHaveBeenCalledWith(event, handler);
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.NOT_REQUIRED,
        lineStatus: 'unknown',
        mobiusSocketStatus: 'unknown',
      });
    });

    it.each([
      CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED,
      CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED,
    ])('detaches the %s listener after deregistration', async (event) => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      await webRTCCalling.registerWebCallingLine();
      const handler = getHandler(callingClient, event);

      await webRTCCalling.deregisterWebCallingLine();

      expect(callingClient.off).toHaveBeenCalledWith(event, handler);
    });

    it('should handle incoming calls', async () => {
      const incomingCallHandler = jest.fn();

      const lineOnSpy = registerLineImmediately(
        {
          mobiusDeviceId: 'device123',
          status: 'registered',
          setError: jest.fn(),
          getError: jest.fn(),
          type: 'line',
          id: 'line1',
        },
        (event, handler) => {
          if (event === LINE_EVENTS.INCOMING_CALL) {
            incomingCallHandler.mockImplementation(handler);
            handler(mockCall);
          }
        }
      );

      await webRTCCalling.registerWebCallingLine();

      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, expect.any(Function));
      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));

      const eventListener = jest.fn();

      webRTCCalling.on('line:incoming_call', eventListener);

      line.on.mock.calls.find((call) => call[0] === LINE_EVENTS.INCOMING_CALL)[1](mockCall);

      expect(eventListener).toHaveBeenCalledWith(mockCall);
    }, 20000); // Increased timeout to 20 seconds
  });

  describe.each([false, true])('contained diagnostics when logger throws=%s', (loggerThrows) => {
    let failure: unknown;
    const createRegistrationLine = () =>
      Object.assign(createEmitter(), {
        register: jest.fn(),
        deregister: jest.fn().mockResolvedValue(undefined),
      });

    beforeEach(() => {
      setBrowserVoiceRequired();
      webex.internal.services.get.mockReturnValue('sip://rtw.prod-us2.rtmsprod.net');
      failure = {message: 'sensitive failure payload', call: mockCall, callback: jest.fn()};
      if (loggerThrows) {
        (LoggerProxy.error as jest.Mock).mockImplementation(() => {
          throw new Error('diagnostic sink failed');
        });
      }
    });

    it.each([LINE_EVENTS.INCOMING_CALL, LINE_EVENTS.REGISTERED, LINE_EVENTS.UNREGISTERED])(
      'diagnoses a throwing %s callback and preserves later listeners and generation fences',
      async (event) => {
        const ownedLine = Object.assign(createEmitter(), {
          register: jest.fn(),
          deregister: jest.fn().mockResolvedValue(undefined),
        });
        (callingClient.getLines as jest.Mock).mockReturnValue({line1: ownedLine});
        const observer = jest.fn(() => {
          throw failure;
        });
        const incoming = event === LINE_EVENTS.INCOMING_CALL;
        const expectedStatus = event === LINE_EVENTS.UNREGISTERED ? 'unregistered' : 'registered';
        webRTCCalling.on(
          incoming ? LINE_EVENTS.INCOMING_CALL : VOICE_CONNECTION_EVENTS.STATE_CHANGE,
          (value) => {
            if (incoming || value.lineStatus === expectedStatus) observer(value);
          }
        );
        const laterListener = jest.fn();
        ownedLine.register.mockImplementation(() => {
          ownedLine.on(event, laterListener);
          ownedLine.emit(LINE_EVENTS.REGISTERED, ownedLine);
        });

        await expect(webRTCCalling.registerWebCallingLine()).resolves.toBeUndefined();
        const payload = incoming ? {...mockCall} : ownedLine;
        if (event !== LINE_EVENTS.REGISTERED) {
          expect(() => ownedLine.emit(event, payload)).not.toThrow();
        }

        expect(observer).toHaveBeenCalledTimes(1);
        expect(laterListener.mock.calls).toEqual([[payload]]);
        expect((LoggerProxy.error as jest.Mock).mock.calls).toEqual([
          [
            'Web calling registration callback failed',
            {
              module: WEB_CALLING_SERVICE_FILE,
              method: METHODS.REGISTER_WEB_CALLING_LINE,
            },
          ],
        ]);
        expect(webRTCCalling.getVoiceConnectionState().lineStatus).toBe(expectedStatus);
        expect(ownedLine.deregister).not.toHaveBeenCalled();
        if (incoming) expect(webRTCCalling['call']).toBe(payload);

        const staleListener = getHandler(ownedLine, event);
        await webRTCCalling.deregisterWebCallingLine();
        (LoggerProxy.error as jest.Mock).mockClear();
        expect(() => staleListener(payload)).not.toThrow();
        expect(observer).toHaveBeenCalledTimes(1);
        expect(LoggerProxy.error).not.toHaveBeenCalled();
      }
    );

    it.each([LINE_EVENTS.ERROR, 'register rejection', 'timeout'])(
      'settles %s before throwing observers and delegates ambiguous calling ownership',
      async (source) => {
        jest.useFakeTimers();
        const ownedLine = createRegistrationLine();
        (callingClient.getLines as jest.Mock).mockReturnValue({line1: ownedLine});
        const timedOut = source === 'timeout';
        const error = timedOut
          ? new Error('WebCallingService Registration timed out')
          : Object.assign(new Error('Registration failed'), {status: 'inactive'});
        let notifyStarted: () => void;
        const started = new Promise<void>((resolve) => {
          notifyStarted = resolve;
        });
        ownedLine.register.mockImplementation(() => {
          notifyStarted();
          if (source === 'register rejection') return Promise.reject(error);
        });
        const settlementAtDelivery = jest.fn();
        webRTCCalling.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, (state) => {
          if (state.lineStatus !== 'error') return;
          settlementAtDelivery({
            reject: webRTCCalling['rejectRegistration'],
            complete: webRTCCalling['registrationCompleteHandler'],
            attempt: webRTCCalling['registrationAttempt'],
            timers: jest.getTimerCount(),
          });
          throw failure;
        });
        const rejected = jest.fn();
        const registration = webRTCCalling.registerWebCallingLine().catch(rejected);
        await started;
        const laterListener = jest.fn();
        ownedLine.on(LINE_EVENTS.ERROR, laterListener);
        if (timedOut) {
          expect(() => jest.advanceTimersByTime(TIMEOUT_DURATION)).not.toThrow();
        } else if (source === LINE_EVENTS.ERROR) {
          expect(() => ownedLine.emit(LINE_EVENTS.ERROR, error)).not.toThrow();
        }
        // Flush the direct register-rejection callback without waiting on a potentially stuck job.
        await Promise.resolve();
        expect(settlementAtDelivery.mock.calls).toEqual([
          [{reject: undefined, complete: undefined, attempt: undefined, timers: 0}],
        ]);
        await registration;
        expect(rejected.mock.calls).toEqual([[error]]);
        expect(laterListener.mock.calls).toEqual(source === LINE_EVENTS.ERROR ? [[error]] : []);
        expect(webRTCCalling['registrationAttempt']).toBeUndefined();
        expect(webRTCCalling.getVoiceConnectionState()).toEqual({
          status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
          lineStatus: 'error',
          mobiusSocketStatus: 'not-in-use',
          reason: timedOut ? 'REGISTRATION_TIMEOUT' : error.message,
          retryable: timedOut,
        });
        expect((LoggerProxy.error as jest.Mock).mock.calls).toEqual([
          [
            'Web calling registration callback failed',
            {
              module: WEB_CALLING_SERVICE_FILE,
              method: METHODS.REGISTER_WEB_CALLING_LINE,
            },
          ],
        ]);
        expect(ownedLine.handlers.get(LINE_EVENTS.REGISTERED)).toHaveLength(1);
        expect(ownedLine.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
        expect(ownedLine.deregister).not.toHaveBeenCalled();

        await webRTCCalling.ensureWebCallingLine();
        expect(webRTCCalling['registrationAttempt']).toBeUndefined();
        expect(createClient).toHaveBeenCalledTimes(1);
        expect(ownedLine.register).toHaveBeenCalledTimes(1);
        expect(ownedLine.deregister).not.toHaveBeenCalled();
        expect(mockCall.end).not.toHaveBeenCalled();
        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it.each([LINE_EVENTS.ERROR, 'register rejection', 'timeout'])(
      'keeps the captured %s rejection and replacement ownership during observer reentry',
      async (source) => {
        jest.useFakeTimers();
        const firstLine = createRegistrationLine();
        const replacementLine = createRegistrationLine();
        (callingClient.getLines as jest.Mock).mockReturnValue({line1: firstLine});
        (createClient as jest.Mock)
          .mockResolvedValueOnce(callingClient)
          .mockResolvedValueOnce({
            ...callingClient,
            ...createEmitter(),
            getLines: () => ({line1: replacementLine}),
          });
        let notifyFirstStarted: () => void;
        const firstStarted = new Promise<void>((resolve) => {
          notifyFirstStarted = resolve;
        });
        let notifyReplacementStarted: () => void;
        const replacementStarted = new Promise<void>((resolve) => {
          notifyReplacementStarted = resolve;
        });
        replacementLine.register.mockImplementation(notifyReplacementStarted);
        const timedOut = source === 'timeout';
        const error = timedOut
          ? new Error('WebCallingService Registration timed out')
          : Object.assign(new Error('Registration failed'), {status: 'inactive'});
        firstLine.register.mockImplementation(() => {
          notifyFirstStarted();
          if (source === 'register rejection') return Promise.reject(error);
        });
        let replacement: Promise<void>;
        webRTCCalling.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, (state) => {
          if (state.lineStatus !== 'error') return;
          replacement = webRTCCalling.registerWebCallingLine();
          throw failure;
        });
        const rejected = jest.fn();
        const first = webRTCCalling.registerWebCallingLine().catch(rejected);
        await firstStarted;
        const staleError = getHandler(firstLine, LINE_EVENTS.ERROR);
        if (timedOut) jest.advanceTimersByTime(TIMEOUT_DURATION);
        else if (source === LINE_EVENTS.ERROR) firstLine.emit(LINE_EVENTS.ERROR, error);
        await replacementStarted;
        const replacementAttempt = webRTCCalling['registrationAttempt'];
        await first;

        expect(rejected.mock.calls).toEqual([[error]]);
        expect(webRTCCalling['registrationAttempt']).toBe(replacementAttempt);
        expect(webRTCCalling['line']).toBe(replacementLine);
        expect(webRTCCalling['rejectRegistration']).toEqual(expect.any(Function));
        staleError(error);
        jest.advanceTimersByTime(TIMEOUT_DURATION - 1);
        expect(webRTCCalling.getVoiceConnectionState().lineStatus).toBe('connecting');
        expect(webRTCCalling['terminalLine']).toBeUndefined();
        replacementLine.emit(LINE_EVENTS.REGISTERED, replacementLine);
        await replacement;
        expect(webRTCCalling['registrationAttempt']).toBeUndefined();
        expect(jest.getTimerCount()).toBe(0);
        expect(webRTCCalling.isVoiceReady()).toBe(true);
        expect(firstLine.deregister).toHaveBeenCalledTimes(1);
        expect(replacementLine.deregister).not.toHaveBeenCalled();
        expect(mockCall.end).not.toHaveBeenCalled();
        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it.each(['ownership inspection', 'attempt startup'])(
      'diagnoses synchronous %s failure without rejecting ensure',
      async (stage) => {
        webRTCCalling['callingClient'] = callingClient;
        const start = jest
          .spyOn(webRTCCalling as any, 'startRegistrationAttempt')
          .mockImplementation(() => {
            throw failure;
          });
        if (stage === 'ownership inspection') {
          (callingClient.getActiveCalls as jest.Mock).mockImplementation(() => {
            throw failure;
          });
        }
        const before = webRTCCalling.getVoiceConnectionState();

        await expect(webRTCCalling.ensureWebCallingLine()).resolves.toBeUndefined();

        expect((LoggerProxy.error as jest.Mock).mock.calls).toEqual([
          [
            'Unable to ensure web calling line',
            {
              module: WEB_CALLING_SERVICE_FILE,
              method: METHODS.ENSURE_WEB_CALLING_LINE,
            },
          ],
        ]);
        expect(start).toHaveBeenCalledTimes(stage === 'ownership inspection' ? 0 : 1);
        expect(webRTCCalling.getVoiceConnectionState()).toEqual(before);
        expect(createClient).not.toHaveBeenCalled();
        expect(callingClient.getLines().line1.deregister).not.toHaveBeenCalled();
        expect(mockCall.end).not.toHaveBeenCalled();
      }
    );

    it('diagnoses a detached preserve-attempt rejection without rejecting ensure', async () => {
      webex.internal.services.waitForCatalog.mockRejectedValue(failure);
      const controller = new AbortController();
      const acknowledgement = webRTCCalling.ensureWebCallingLine(controller.signal);
      const attempt = webRTCCalling['registrationAttempt'];
      controller.abort();

      await expect(acknowledgement).resolves.toBeUndefined();
      await expect(attempt.promise).rejects.toBe(failure);

      expect((LoggerProxy.error as jest.Mock).mock.calls).toEqual([
        [
          'Web calling preserve registration failed',
          {
            module: WEB_CALLING_SERVICE_FILE,
            method: METHODS.ENSURE_WEB_CALLING_LINE,
          },
        ],
      ]);
      expect(webRTCCalling['registrationAttempt']).toBeUndefined();
      expect(createClient).not.toHaveBeenCalled();

      webex.internal.services.waitForCatalog.mockResolvedValue(undefined);
      registerLineImmediately();
      await expect(webRTCCalling.ensureWebCallingLine()).resolves.toBeUndefined();
      await expect(webRTCCalling['registrationAttempt'].promise).resolves.toBeUndefined();
      expect(webRTCCalling.isVoiceReady()).toBe(true);
    });
  });

  describe('deregisterWebCallingLine', () => {
    it('should deregister the web calling line', async () => {
      line = callingClient.getLines().line1 as ILine;
      webRTCCalling['line'] = line; // Ensure line is set before calling deregister

      const deregisterSpy = jest.spyOn(line, 'deregister');

      await webRTCCalling.deregisterWebCallingLine();

      expect(deregisterSpy).toHaveBeenCalled();
    });
  });

  describe('answerCall', () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue(['']),
      },
    };

    const localAudioStream = mockStream as unknown as LocalMicrophoneStream;

    it('should answer the call and log info when call exists', () => {
      webRTCCalling.answerCall(localAudioStream, 'task-id');

      expect(LoggerProxy.info).toHaveBeenCalledWith('Call answered: task-id', {
        module: WEB_CALLING_SERVICE_FILE,
        method: 'answerCall',
      });
      expect(mockCall.answer).toHaveBeenCalledWith(localAudioStream);
    });

    it('should log error and throw when call.answer fails', () => {
      const error = new Error('Failed to answer');
      mockCall.answer.mockImplementation(() => {
        throw error;
      });

      expect(() => webRTCCalling.answerCall(localAudioStream, 'task-id')).toThrow(error);
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `Failed to answer call for task-id. Error: ${error}`,
        {
          module: WEB_CALLING_SERVICE_FILE,
          method: 'answerCall',
        }
      );
    });

    it('should log when there is no call to answer', () => {
      webRTCCalling.call = null;
      webRTCCalling.answerCall(localAudioStream, 'task-id');

      expect(LoggerProxy.log).toHaveBeenCalledWith('Cannot answer a non WebRtc Call: task-id', {
        module: WEB_CALLING_SERVICE_FILE,
        method: 'answerCall',
      });
    });
  });

  describe('muteUnmuteCall', () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue(['']),
      },
    };

    const localAudioStream = mockStream as unknown as LocalMicrophoneStream;

    it('should mute the call and log info when call exists', () => {
      webRTCCalling.muteUnmuteCall(localAudioStream);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Call mute or unmute requested!', {
        module: WEB_CALLING_SERVICE_FILE,
        method: 'muteUnmuteCall',
      });
      expect(mockCall.mute).toHaveBeenCalledWith(localAudioStream);
    });

    it('should log when there is no call to mute', () => {
      webRTCCalling.call = null;
      webRTCCalling.muteUnmuteCall(localAudioStream);

      expect(LoggerProxy.log).toHaveBeenCalledWith('Cannot mute a non WebRtc Call', {
        module: WEB_CALLING_SERVICE_FILE,
        method: 'muteUnmuteCall',
      });
    });
  });

  describe('declineCall', () => {
    it('should end the call and log info when call exists', () => {
      webRTCCalling.declineCall('task-id');

      expect(LoggerProxy.info).toHaveBeenCalledWith('Call end requested: task-id', {
        module: WEB_CALLING_SERVICE_FILE,
        method: 'declineCall',
      });
      expect(mockCall.end).toHaveBeenCalled();
    });

    it('should log error and throw when call.end fails', () => {
      const error = new Error('Failed to end call');
      mockCall.end.mockImplementation(() => {
        throw error;
      });

      expect(() => webRTCCalling.declineCall('task-id')).toThrow(error);
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `Failed to end call: task-id. Error: ${error}`,
        {
          module: WEB_CALLING_SERVICE_FILE,
          method: 'declineCall',
        }
      );
    });

    it('should log when there is no call to end', () => {
      webRTCCalling.call = null;
      webRTCCalling.declineCall('task-id');

      expect(LoggerProxy.log).toHaveBeenCalledWith('Cannot end a non WebRtc Call: task-id', {
        module: WEB_CALLING_SERVICE_FILE,
        method: 'declineCall',
      });
    });
  });

  describe('mapCallToTask', () => {
    it('should map a call ID to a task ID', () => {
      const callId = 'call-id-123';
      const taskId = 'task-id-456';

      webRTCCalling.mapCallToTask(callId, taskId);

      expect(webRTCCalling.getTaskIdForCall(callId)).toBe(taskId);
    });
  });

  describe('getTaskIdForCall', () => {
    it('should return the task ID for a given call ID', () => {
      const callId = 'call-id-123';
      const taskId = 'task-id-456';

      webRTCCalling.mapCallToTask(callId, taskId);

      const result = webRTCCalling.getTaskIdForCall(callId);

      expect(result).toBe(taskId);
    });

    it('should return undefined if the call ID is not mapped', () => {
      const callId = 'call-id-123';
      const result = webRTCCalling.getTaskIdForCall(callId);

      expect(result).toBeUndefined();
    });
  });

  describe('cleanUpCall', () => {
    const installCall = (callId = 'call-id-123') => {
      const call = {...mockCall, ...createEmitter(), getCallId: jest.fn(() => callId)};
      (webRTCCalling as any).call = call;
      webRTCCalling.answerCall({} as LocalMicrophoneStream, 'ending-task');

      return call;
    };

    it('should clean up the call and remove listeners', () => {
      const call = installCall();
      webRTCCalling.mapCallToTask(call.getCallId(), 'ending-task');
      webRTCCalling.cleanUpCall();

      expect(call.off.mock.calls).toEqual(call.on.mock.calls);
      expect(call.handlers.get(CALL_EVENT_KEYS.REMOTE_MEDIA)).toEqual([]);
      expect(call.handlers.get(CALL_EVENT_KEYS.DISCONNECT)).toEqual([]);
      expect(webRTCCalling.call).toBeNull();
      expect(webRTCCalling.getTaskIdForCall(call.getCallId())).toBeUndefined();
      expect(call.end).not.toHaveBeenCalled();
    });

    it.each([
      {owner: undefined, dispose: false},
      {owner: 'ending-task', dispose: true},
      {owner: 'other-task', dispose: false},
    ])('task-aware cleanup with owner=$owner', ({owner, dispose}) => {
      const call = installCall();
      if (owner) webRTCCalling.mapCallToTask(call.getCallId(), owner);
      const disposed = jest.fn();

      webRTCCalling.cleanUpCallForTask('ending-task', disposed);
      webRTCCalling.cleanUpCallForTask('ending-task', disposed);

      if (dispose) {
        expect(call.off.mock.calls).toEqual(call.on.mock.calls);
        expect(call.handlers.get(CALL_EVENT_KEYS.REMOTE_MEDIA)).toEqual([]);
        expect(call.handlers.get(CALL_EVENT_KEYS.DISCONNECT)).toEqual([]);
        expect(webRTCCalling.call).toBeNull();
        expect(webRTCCalling.getTaskIdForCall(call.getCallId())).toBeUndefined();
        expect(disposed.mock.calls).toEqual([[call]]);
      } else {
        expect(call.off).not.toHaveBeenCalled();
        expect(call.handlers.get(CALL_EVENT_KEYS.REMOTE_MEDIA)).toHaveLength(1);
        expect(call.handlers.get(CALL_EVENT_KEYS.DISCONNECT)).toHaveLength(1);
        expect(webRTCCalling.call).toBe(call);
        expect(webRTCCalling.getTaskIdForCall(call.getCallId())).toBe(owner);
        expect(disposed).not.toHaveBeenCalled();
      }
      expect(call.end).not.toHaveBeenCalled();
    });

    it.each([CALL_EVENT_KEYS.REMOTE_MEDIA, CALL_EVENT_KEYS.DISCONNECT])(
      'finishes task-aware disposal when removing %s throws', (event) => {
        const call = installCall();
        const off = call.off.getMockImplementation();
        const error = new Error('listener removal failed');
        call.off.mockImplementation((key, handler) => {
          off(key, handler);
          if (key === event) throw error;
        });
        webRTCCalling.mapCallToTask(call.getCallId(), 'ending-task');
        const disposed = jest.fn();

        expect(() => webRTCCalling.cleanUpCallForTask('ending-task', disposed))
          .toThrow(error);

        expect(call.off.mock.calls).toEqual(call.on.mock.calls);
        expect(webRTCCalling.call).toBeNull();
        expect(webRTCCalling.getTaskIdForCall(call.getCallId())).toBeUndefined();
        expect(disposed.mock.calls).toEqual([[call]]);
        expect(call.end).not.toHaveBeenCalled();
      }
    );

    it.each(['call-id-123', 'replacement-call'])(
      'preserves a reentrant replacement with id %s', (replacementId) => {
        const call = installCall();
        webRTCCalling.mapCallToTask(call.getCallId(), 'ending-task');
        const off = call.off.getMockImplementation();
        let replacement;
        call.off.mockImplementationOnce((event, handler) => {
          off(event, handler);
          replacement = installCall(replacementId);
          webRTCCalling.mapCallToTask(replacementId, 'other-task');
        });
        const disposed = jest.fn();

        webRTCCalling.cleanUpCallForTask('ending-task', disposed);
        webRTCCalling.cleanUpCallForTask('ending-task', disposed);
        webRTCCalling.cleanUpCall(call);

        expect(call.off.mock.calls).toEqual(call.on.mock.calls);
        expect(disposed.mock.calls).toEqual([[call]]);
        expect(webRTCCalling.call).toBe(replacement);
        expect(webRTCCalling.getTaskIdForCall(replacementId)).toBe('other-task');
        if (replacementId !== call.getCallId()) {
          expect(webRTCCalling.getTaskIdForCall(call.getCallId())).toBeUndefined();
        }
        expect(replacement.off).not.toHaveBeenCalled();
        expect(call.end).not.toHaveBeenCalled();
      }
    );

    it('does not dispose or report a call replaced during the ownership check', () => {
      const call = installCall();
      webRTCCalling.mapCallToTask(call.getCallId(), 'ending-task');
      const disposed = jest.fn();
      let replacement;

      jest.spyOn(webRTCCalling, 'getTaskIdForCall').mockImplementationOnce(() => {
        replacement = installCall('replacement-call');

        return 'ending-task';
      });

      webRTCCalling.cleanUpCallForTask('ending-task', disposed);

      expect(webRTCCalling.call).toBe(replacement);
      expect(call.off).not.toHaveBeenCalled();
      expect(disposed).not.toHaveBeenCalled();
    });
  });
  describe('T-009 calling preserve ownership', () => {
    const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
    const terminalEvidenceKinds = ['none', 'current', 'stale-generation', 'wrong-line'] as const;
    const ownershipMatrix = [
      {status: VoiceLineStatus.UNKNOWN, replaceStoppedLine: true},
      {status: VoiceLineStatus.CONNECTING, replaceStoppedLine: false},
      {status: VoiceLineStatus.REGISTERED, replaceStoppedLine: false},
      {status: VoiceLineStatus.RECONNECTING, replaceStoppedLine: false},
      {status: VoiceLineStatus.RECONNECTED, replaceStoppedLine: false},
      {status: VoiceLineStatus.UNREGISTERED, replaceStoppedLine: true},
      {status: VoiceLineStatus.ERROR, replaceStoppedLine: true},
    ].flatMap(({status, replaceStoppedLine}) =>
      [false, true].flatMap(present =>
        [false, true].flatMap(active =>
          terminalEvidenceKinds.flatMap(terminalEvidence =>
            [false, true].map(liveJob => ({
              status,
              present,
              active,
              terminalEvidence,
              liveJob,
              shouldStart: !liveJob && !active &&
                (!present || (terminalEvidence === 'current' && replaceStoppedLine)),
            }))
          )
        )
      )
    );

    it.each(ownershipMatrix)(
      'ensureLineStatusOwnershipMatrix: $status line=$present activeCall=$active terminal=$terminalEvidence liveJob=$liveJob',
      async ({status, present, active, terminalEvidence, liveJob, shouldStart}) => {
        setBrowserVoiceRequired();
        const ownedLine = callingClient.getLines().line1;
        const unrelatedLine = {...ownedLine, deregister: jest.fn()};
        const generation = 7;
        const currentLine = present ? ownedLine : undefined;
        const currentCall = active ? mockCall : undefined;
        const terminalLine = terminalEvidence === 'none' ? undefined : {
          generation: terminalEvidence === 'stale-generation' ? generation - 1 : generation,
          line: terminalEvidence === 'wrong-line' ? unrelatedLine : ownedLine,
        };
        const attempt = liveJob ? {
          generation,
          promise: new Promise<void>(() => {}),
          cancel: jest.fn(),
        } : undefined;
        Object.assign(webRTCCalling, {
          line: currentLine,
          call: currentCall,
          callingClient,
          registrationGeneration: generation,
          terminalLine,
          registrationAttempt: attempt,
        });
        (callingClient.getActiveCalls as jest.Mock).mockReturnValue(active ? {held: [mockCall]} : {});
        (webRTCCalling as any).voiceConnectionState.lineStatus = status;
        const start = jest.spyOn(webRTCCalling as any, 'startRegistrationAttempt')
          .mockResolvedValue(undefined);

        await expect(webRTCCalling.ensureWebCallingLine()).resolves.toBeUndefined();

        expect(start.mock.calls).toEqual(shouldStart ? [['preserve']] : []);
        expect((webRTCCalling as any).line).toBe(currentLine);
        expect(webRTCCalling.call).toBe(currentCall);
        expect((webRTCCalling as any).callingClient).toBe(callingClient);
        expect((webRTCCalling as any).registrationGeneration).toBe(generation);
        expect((webRTCCalling as any).terminalLine).toBe(terminalLine);
        expect((webRTCCalling as any).registrationAttempt).toBe(attempt);
        if (attempt) expect(attempt.cancel).not.toHaveBeenCalled();
        expect(createClient).not.toHaveBeenCalled();
        expect(ownedLine.register).not.toHaveBeenCalled();
        expect(ownedLine.deregister).not.toHaveBeenCalled();
        expect(ownedLine.off).not.toHaveBeenCalled();
        expect(unrelatedLine.deregister).not.toHaveBeenCalled();
        expect(callingClient.off).not.toHaveBeenCalled();
        expect(mockCall.end).not.toHaveBeenCalled();
      }
    );

    it.each(['unregistered', 'error'])('unregisteredActiveCallDefersToCallingOwner: %s', async (status) => {
      setBrowserVoiceRequired();
      const ownedLine = callingClient.getLines().line1;
      (webRTCCalling as any).callingClient = callingClient;
      (webRTCCalling as any).line = ownedLine;
      (webRTCCalling as any).call = undefined;
      (webRTCCalling as any).voiceConnectionState.lineStatus = status;
      (webRTCCalling as any).terminalLine = {generation: 0, line: ownedLine};
      (callingClient.getActiveCalls as jest.Mock).mockReturnValue({held: [mockCall]});
      const start = jest.spyOn(webRTCCalling as any, 'startRegistrationAttempt');

      const acknowledgement = webRTCCalling.ensureWebCallingLine();

      expect(start).not.toHaveBeenCalled();
      expect((webRTCCalling as any).registrationAttempt).toBeUndefined();
      expect((webRTCCalling as any).line).toBe(ownedLine);
      expect(ownedLine.deregister).not.toHaveBeenCalled();

      await acknowledgement;
      await flush();
      expect(createClient).not.toHaveBeenCalled();
    });

    it('ensureLineStatusOwnershipMatrix / ensureAcknowledgesBeforeRegistrationSettles', async () => {
      jest.useFakeTimers();
      setBrowserVoiceRequired();
      await expect(webRTCCalling.ensureWebCallingLine()).resolves.toBeUndefined();
      await flush();
      expect((webRTCCalling as any).registrationAttempt).toBeDefined();
      jest.advanceTimersByTime(TIMEOUT_DURATION);
      await flush();
      expect((webRTCCalling as any).registrationAttempt).toBeUndefined();
      await webRTCCalling.deregisterWebCallingLine();
      jest.useRealTimers();
    });

    it('abortedEnsureCallerDoesNotCancelSharedAttempt', async () => {
      jest.useFakeTimers();
      setBrowserVoiceRequired();
      const first = new AbortController();
      const second = new AbortController();
      await webRTCCalling.ensureWebCallingLine(first.signal);
      const owner = (webRTCCalling as any).registrationAttempt;
      first.abort();
      await webRTCCalling.ensureWebCallingLine(second.signal);
      expect((webRTCCalling as any).registrationAttempt).toBe(owner);
      await flush();
      expect(createClient).toHaveBeenCalledTimes(1);
      const ownedLine = callingClient.getLines().line1;
      (ownedLine.on as jest.Mock).mock.calls.filter(([event]) => event === LINE_EVENTS.REGISTERED).forEach(([, handler]) => handler(ownedLine));
      await flush();
      expect(ownedLine.deregister).not.toHaveBeenCalled();
      expect((webRTCCalling as any).registrationAttempt).toBeUndefined();
      await webRTCCalling.deregisterWebCallingLine();
      jest.useRealTimers();
    });

    it('allEnsureCallersDetachedAttemptObserved', async () => {
      jest.useFakeTimers();
      setBrowserVoiceRequired();
      const controller = new AbortController();
      await webRTCCalling.ensureWebCallingLine(controller.signal);
      controller.abort();
      await flush();
      getHandler(callingClient.getLines().line1, LINE_EVENTS.ERROR)({status: 'inactive', message: 'terminal'});
      await flush();
      expect((webRTCCalling as any).registrationAttempt).toBeUndefined();
      await webRTCCalling.deregisterWebCallingLine();
      jest.useRealTimers();
    });

    it('notRequiredRetainsOwnedLine', async () => {
      registerLineImmediately();
      setBrowserVoiceRequired();
      await webRTCCalling.registerWebCallingLine();
      const count = (createClient as jest.Mock).mock.calls.length;
      const incoming = getHandler(line, LINE_EVENTS.INCOMING_CALL);
      const transport = webRTCCalling.getVoiceConnectionState();
      webRTCCalling.setBrowserVoiceRequired(false);
      await webRTCCalling.ensureWebCallingLine();
      expect((createClient as jest.Mock).mock.calls.length).toBe(count);
      expect(line.deregister).not.toHaveBeenCalled();
      expect(getHandler(line, LINE_EVENTS.INCOMING_CALL)).toBe(incoming);
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({...transport, status: VOICE_CONNECTION_STATUS.NOT_REQUIRED});
    });

    it('cleanUpCall ignores a replacement identity', () => {
      const replacement = {...mockCall};
      (webRTCCalling as any).call = replacement;
      webRTCCalling.cleanUpCall(mockCall);
      expect((webRTCCalling as any).call).toBe(replacement);
      expect(mockCall.off).not.toHaveBeenCalled();
    });
  });

  describe('T-009 real retained calling owner', () => {
    const flush = async () => { for (let i = 0; i < 16; i += 1) await Promise.resolve(); };
    const owned = (registered = true) => {
      const line = Object.assign(createEmitter(), {register: jest.fn(), deregister: jest.fn().mockResolvedValue(undefined)});
      if (registered) line.register.mockImplementation(() => line.emit(LINE_EVENTS.REGISTERED, line));
      const client = Object.assign(createEmitter(), {getLines: () => ({line}), getActiveCalls: jest.fn(() => ({})), isMobiusSocketConnected: () => false});
      return {line, client};
    };

    const registrationError = (
      type: ERROR_TYPE,
      method = 'triggerRegistration',
      status = 'inactive',
      file = 'register'
    ) => Object.assign(new Error('Calling registration failed'), {type, status, context: {file, method}});
    const terminalErrors = [
      {type: ERROR_TYPE.SERVICE_UNAVAILABLE, method: 'startFailoverTimer'},
      {type: ERROR_TYPE.BAD_REQUEST, method: 'triggerRegistration'},
      {type: ERROR_TYPE.TOKEN_ERROR, method: 'triggerRegistration'},
    ];

    it.each(['replace', 'deregister'].flatMap(mode =>
      ['success', 'rejection'].map(settlement => ({mode, settlement}))
    ))(
      'ensureAcknowledgesBeforeRegistrationSettles: $mode supersedes preserve before late $settlement',
      async ({mode, settlement}) => {
        jest.useFakeTimers();
        const first = owned(false);
        const replacement = owned(false);
        let resolveRegistration: () => void;
        let rejectRegistration: (error: Error) => void;
        first.line.register.mockReturnValue(new Promise<void>((resolve, reject) => {
          resolveRegistration = resolve;
          rejectRegistration = reject;
        }));
        (createClient as jest.Mock)
          .mockResolvedValueOnce(first.client)
          .mockResolvedValueOnce(replacement.client);
        webex.internal.services.get.mockReturnValue('https://rtw.prod-us1.rtmsprod.net');
        setBrowserVoiceRequired();
        const caller = new AbortController();
        const unhandled = jest.fn();
        process.on('unhandledRejection', unhandled);

        try {
          expect(caller.signal.aborted).toBe(false);
          const acknowledgement = webRTCCalling.ensureWebCallingLine(caller.signal);
          const oldOwner = webRTCCalling['registrationAttempt'];
          expect(oldOwner).toBeDefined();
          await expect(acknowledgement).resolves.toBeUndefined();
          await flush();

          expect(first.line.register).toHaveBeenCalledTimes(1);
          expect(webRTCCalling['registrationAttempt']).toBe(oldOwner);
          expect(webRTCCalling['line']).toBe(first.line);
          expect(webRTCCalling['callingClient']).toBe(first.client);
          expect(first.line.handlers.get(LINE_EVENTS.REGISTERED)).toHaveLength(2);
          expect(jest.getTimerCount()).toBe(1);
          const oldLineListeners = first.line.on.mock.calls.slice();
          const oldClientListeners = first.client.on.mock.calls.slice();

          caller.abort();
          await flush();
          expect(webRTCCalling['registrationAttempt']).toBe(oldOwner);
          expect(first.line.deregister).not.toHaveBeenCalled();
          expect(first.line.off).not.toHaveBeenCalled();
          expect(first.client.off).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(1);

          const replacing = mode === 'replace';
          const supersession = replacing
            ? webRTCCalling.registerWebCallingLine()
            : webRTCCalling.deregisterWebCallingLine();
          const replacementOwner = webRTCCalling['registrationAttempt'];
          if (replacing) {
            expect(replacementOwner).toBeDefined();
            expect(replacementOwner).not.toBe(oldOwner);
          } else {
            expect(replacementOwner).toBeUndefined();
          }
          await flush();
          if (!replacing) await supersession;

          expect(createClient).toHaveBeenCalledTimes(replacing ? 2 : 1);
          expect(replacement.line.register).toHaveBeenCalledTimes(replacing ? 1 : 0);
          expect(first.line.deregister).toHaveBeenCalledTimes(1);
          oldLineListeners.forEach(([event, handler]) => {
            expect(first.line.off).toHaveBeenCalledWith(event, handler);
            expect(first.line.handlers.get(event)).toEqual([]);
          });
          oldClientListeners.forEach(([event, handler]) => {
            expect(first.client.off).toHaveBeenCalledWith(event, handler);
            expect(first.client.handlers.get(event)).toEqual([]);
          });
          expect(jest.getTimerCount()).toBe(replacing ? 1 : 0);
          const currentReject = webRTCCalling['rejectRegistration'];
          const currentComplete = webRTCCalling['registrationCompleteHandler'];
          expect(currentReject).toEqual(replacing ? expect.any(Function) : undefined);
          expect(currentComplete).toEqual(replacing ? expect.any(Function) : undefined);
          const state = webRTCCalling.getVoiceConnectionState();
          const call = webRTCCalling['call'];
          const stateChanged = jest.fn();
          const incomingCall = jest.fn();
          webRTCCalling.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, stateChanged);
          webRTCCalling.on(LINE_EVENTS.INCOMING_CALL, incomingCall);
          const error = registrationError(ERROR_TYPE.BAD_REQUEST);

          if (settlement === 'success') resolveRegistration();
          else rejectRegistration(error);
          // Exercise both detached emitters and callbacks already queued before teardown.
          const payloads = new Map<string, unknown>([
            [LINE_EVENTS.REGISTERED, first.line],
            [LINE_EVENTS.ERROR, error],
            [LINE_EVENTS.UNREGISTERED, error],
            [LINE_EVENTS.INCOMING_CALL, mockCall],
            [CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED, {reason: 'transient'}],
          ]);
          oldLineListeners.forEach(([event, handler]) => {
            first.line.emit(event, payloads.get(event));
            handler(payloads.get(event));
          });
          oldClientListeners.forEach(([event, handler]) => {
            first.client.emit(event, payloads.get(event));
            handler(payloads.get(event));
          });
          await flush();
          // Let unhandled rejections surface while registration deadlines remain faked.
          await new Promise<void>(resolve => jest.requireActual('timers').setImmediate(resolve));

          expect(webRTCCalling['registrationAttempt']).toBe(replacementOwner);
          expect(webRTCCalling['line']).toBe(replacing ? replacement.line : undefined);
          expect(webRTCCalling['callingClient']).toBe(replacing ? replacement.client : undefined);
          expect(webRTCCalling['rejectRegistration']).toBe(currentReject);
          expect(webRTCCalling['registrationCompleteHandler']).toBe(currentComplete);
          expect(webRTCCalling['terminalLine']).toBeUndefined();
          expect(webRTCCalling['call']).toBe(call);
          expect(webRTCCalling.getVoiceConnectionState()).toEqual(state);
          expect(stateChanged).not.toHaveBeenCalled();
          expect(incomingCall).not.toHaveBeenCalled();
          expect(first.line.deregister).toHaveBeenCalledTimes(1);
          expect(replacement.line.deregister).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(replacing ? 1 : 0);
          expect(LoggerProxy.error).not.toHaveBeenCalled();
          expect(unhandled).not.toHaveBeenCalled();

          if (replacing) replacement.line.emit(LINE_EVENTS.REGISTERED, replacement.line);
          await supersession;
          expect(webRTCCalling['registrationAttempt']).toBeUndefined();
          expect(webRTCCalling.isVoiceReady()).toBe(replacing);
          await webRTCCalling.deregisterWebCallingLine();
          expect(replacement.line.deregister).toHaveBeenCalledTimes(replacing ? 1 : 0);
          expect(first.line.deregister).toHaveBeenCalledTimes(1);
          expect(jest.getTimerCount()).toBe(0);
          jest.advanceTimersByTime(TIMEOUT_DURATION);
          await flush();
          expect(LoggerProxy.error).not.toHaveBeenCalled();
          expect(unhandled).not.toHaveBeenCalled();
        } finally {
          await webRTCCalling.deregisterWebCallingLine();
          process.removeListener('unhandledRejection', unhandled);
        }
      }
    );

    it.each(terminalErrors.flatMap(error => ['pending', 'registered', 'active call'].map(owner => ({...error, owner}))))(
      'replaces a confirmed terminal $type after $owner registration settlement only without calls',
      async ({type, method, owner}) => {
        const first = owned(owner !== 'pending');
        const replacement = owned(false);
        (createClient as jest.Mock)
          .mockResolvedValueOnce(first.client)
          .mockResolvedValueOnce(replacement.client);
        setBrowserVoiceRequired();
        const rejected = jest.fn();
        const registration = webRTCCalling.registerWebCallingLine().catch(rejected);
        await flush();
        expect(first.line.register).toHaveBeenCalledTimes(1);
        webRTCCalling.cleanUpCall();
        first.client.getActiveCalls.mockReturnValue(owner === 'active call' ? {held: [mockCall]} : {});
        const staleError = getHandler(first.line, LINE_EVENTS.ERROR);
        const error = registrationError(type, method);

        first.line.emit(LINE_EVENTS.ERROR, error);
        await registration;
        await flush();
        expect(rejected.mock.calls).toEqual(owner === 'pending' ? [[error]] : []);
        expect(webRTCCalling['registrationAttempt']).toBeUndefined();
        expect(webRTCCalling.getVoiceConnectionState().lineStatus).toBe('error');

        await Promise.all([webRTCCalling.ensureWebCallingLine(), webRTCCalling.ensureWebCallingLine()]);
        await flush();
        const replace = owner !== 'active call';
        expect(createClient).toHaveBeenCalledTimes(replace ? 2 : 1);
        expect(first.line.register).toHaveBeenCalledTimes(1);
        expect(first.line.deregister).toHaveBeenCalledTimes(replace ? 1 : 0);
        expect(replacement.line.register).toHaveBeenCalledTimes(replace ? 1 : 0);
        expect(mockCall.end).not.toHaveBeenCalled();

        if (replace) {
          // New registration clears the old stop; retired events cannot stop its live owner.
          staleError(error);
          expect(webRTCCalling['terminalLine']).toBeUndefined();
          const attempt = webRTCCalling['registrationAttempt'];
          expect(attempt).toBeDefined();
          await webRTCCalling.ensureWebCallingLine();
          expect(webRTCCalling['registrationAttempt']).toBe(attempt);
          replacement.line.emit(LINE_EVENTS.REGISTERED, replacement.line);
          await flush();
          await webRTCCalling.ensureWebCallingLine();
          expect(createClient).toHaveBeenCalledTimes(2);
          expect(replacement.line.register).toHaveBeenCalledTimes(1);
          expect(replacement.line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
          expect([...first.line.handlers.values()].every(handlers => handlers.length === 0)).toBe(true);
        } else {
          expect(first.line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
          expect(first.line.handlers.get(LINE_EVENTS.REGISTERED)).toHaveLength(1);
        }
        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it.each([
      {type: ERROR_TYPE.DEFAULT},
      {type: ERROR_TYPE.SERVER_ERROR},
      {type: ERROR_TYPE.SERVICE_UNAVAILABLE, method: 'triggerRegistration'},
      {type: ERROR_TYPE.SERVICE_UNAVAILABLE, method: 'unknown'},
      {type: ERROR_TYPE.BAD_REQUEST, file: 'unknown'},
      {type: ERROR_TYPE.TOKEN_ERROR, file: 'unknown'},
      ...terminalErrors.map(error => ({...error, status: 'active'})),
    ])('delegates uncertain or active error $type $method $status $file', async ({
      type, method, status, file,
    }) => {
      const {line, client} = owned();
      (createClient as jest.Mock).mockResolvedValue(client);
      setBrowserVoiceRequired();
      await webRTCCalling.registerWebCallingLine();
      webRTCCalling.cleanUpCall();
      const listeners = new Map(line.handlers);

      line.emit(LINE_EVENTS.ERROR, registrationError(type, method, status, file));
      await flush();
      await webRTCCalling.ensureWebCallingLine();

      expect(createClient).toHaveBeenCalledTimes(1);
      expect(line.register).toHaveBeenCalledTimes(1);
      expect(line.deregister).not.toHaveBeenCalled();
      expect(line.handlers).toEqual(listeners);
      expect(webRTCCalling['terminalLine']).toBeUndefined();
      expect(mockCall.end).not.toHaveBeenCalled();
      await webRTCCalling.deregisterWebCallingLine();
    });

    it.each([LINE_EVENTS.CONNECTING, LINE_EVENTS.RECONNECTING, LINE_EVENTS.REGISTERED, LINE_EVENTS.RECONNECTED])(
      'clears final error evidence when calling resumes through %s', async event => {
        const {line, client} = owned();
        (createClient as jest.Mock).mockResolvedValue(client);
        setBrowserVoiceRequired();
        await webRTCCalling.registerWebCallingLine();
        line.emit(LINE_EVENTS.ERROR, registrationError(ERROR_TYPE.SERVICE_UNAVAILABLE, 'startFailoverTimer'));

        line.emit(event, line);
        await webRTCCalling.ensureWebCallingLine();

        expect(webRTCCalling['terminalLine']).toBeUndefined();
        expect(createClient).toHaveBeenCalledTimes(1);
        expect(line.register).toHaveBeenCalledTimes(1);
        expect(line.deregister).not.toHaveBeenCalled();
        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it.each(
      [ERROR_TYPE.BAD_REQUEST, ERROR_TYPE.TOKEN_ERROR].flatMap(type =>
        [false, true].map(activeCall => ({type, activeCall}))
      )
    )('T-009 preserves a terminal keepalive $type through bare unregistration with active call=$activeCall', async ({
      type,
      activeCall,
    }) => {
      const {line, client} = owned();
      const replacement = owned(false);
      (createClient as jest.Mock)
        .mockResolvedValueOnce(client)
        .mockResolvedValueOnce(replacement.client);
      setBrowserVoiceRequired();
      await webRTCCalling.registerWebCallingLine();
      client.getActiveCalls.mockReturnValue(activeCall ? {held: [mockCall]} : {});

      line.emit(LINE_EVENTS.ERROR, registrationError(type, 'startKeepaliveTimer'));
      line.emit(LINE_EVENTS.UNREGISTERED);
      line.emit(LINE_EVENTS.UNREGISTERED);
      expect(webRTCCalling.getVoiceConnectionState()).toMatchObject({
        lineStatus: 'unregistered',
        reason: 'LINE_UNREGISTERED',
        retryable: true,
      });

      await Promise.all([webRTCCalling.ensureWebCallingLine(), webRTCCalling.ensureWebCallingLine()]);
      await flush();

      expect(createClient).toHaveBeenCalledTimes(activeCall ? 1 : 2);
      expect(line.register).toHaveBeenCalledTimes(1);
      expect(line.deregister).toHaveBeenCalledTimes(activeCall ? 0 : 1);
      expect(replacement.line.register).toHaveBeenCalledTimes(activeCall ? 0 : 1);
      expect(mockCall.end).not.toHaveBeenCalled();

      if (!activeCall) {
        replacement.line.emit(LINE_EVENTS.REGISTERED, replacement.line);
        await flush();
      }
      await webRTCCalling.deregisterWebCallingLine();
    });

    it.each([false, true])('delegates restartable keepalive 404 events with active call=%s', async active => {
      const {line, client} = owned();
      (createClient as jest.Mock).mockResolvedValue(client);
      setBrowserVoiceRequired();
      await webRTCCalling.registerWebCallingLine();
      webRTCCalling.cleanUpCall();
      client.getActiveCalls.mockReturnValue(active ? {held: [mockCall]} : {});
      const acknowledgements: Array<Promise<void>> = [];
      line.on(LINE_EVENTS.ERROR, () => acknowledgements.push(webRTCCalling.ensureWebCallingLine()));
      line.on(LINE_EVENTS.UNREGISTERED, () => acknowledgements.push(webRTCCalling.ensureWebCallingLine()));
      const listeners = new Map(line.handlers);

      line.emit(LINE_EVENTS.ERROR, registrationError(ERROR_TYPE.NOT_FOUND, 'startKeepaliveTimer'));
      await Promise.all(acknowledgements.splice(0));
      await flush();
      expect(createClient).toHaveBeenCalledTimes(1);
      line.emit(LINE_EVENTS.UNREGISTERED);
      await Promise.all(acknowledgements);
      await flush();
      await webRTCCalling.ensureWebCallingLine();

      expect(createClient).toHaveBeenCalledTimes(1);
      expect(line.register).toHaveBeenCalledTimes(1);
      expect(line.deregister).not.toHaveBeenCalled();
      expect(line.handlers).toEqual(listeners);
      expect(webRTCCalling['terminalLine']).toBeUndefined();
      expect(mockCall.end).not.toHaveBeenCalled();
      await webRTCCalling.deregisterWebCallingLine();
    });

    it('healthyLineRetainedWithSingleListeners and registeredLineWithMobiusDisconnectedRetained', async () => {
      const {line, client} = owned();
      (createClient as jest.Mock).mockResolvedValue(client);
      setBrowserVoiceRequired();
      await webRTCCalling.registerWebCallingLine();
      client.emit(CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED, {reason: 'transient'});
      const before = webRTCCalling.getVoiceConnectionState();
      await Promise.all([webRTCCalling.ensureWebCallingLine(), webRTCCalling.ensureWebCallingLine()]);
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(line.deregister).not.toHaveBeenCalled();
      expect(line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
      expect(line.handlers.get(LINE_EVENTS.REGISTERED)).toHaveLength(1);
      expect(client.handlers.get(CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED)).toHaveLength(1);
      expect(webRTCCalling.getVoiceConnectionState()).toEqual(before);
      await webRTCCalling.deregisterWebCallingLine();
    });

    it.each([
      {name: 'keepalive ERROR', hardStop: false, errorStatus: 'inactive'},
      {name: 'inactive ERROR after a hard stop', hardStop: true, errorStatus: 'inactive'},
      {name: 'active ERROR after a hard stop', hardStop: true, errorStatus: 'active'},
      {name: 'bare UNREGISTERED after a hard stop', hardStop: true, errorStatus: undefined},
    ])('retains calling ownership through $name and bare UNREGISTERED recovery', async ({
      hardStop,
      errorStatus,
    }) => {
      const {line, client} = owned();
      (createClient as jest.Mock).mockResolvedValue(client);
      setBrowserVoiceRequired();
      await webRTCCalling.registerWebCallingLine();
      webRTCCalling.cleanUpCall();
      if (hardStop) {
        line.emit(LINE_EVENTS.UNREGISTERED, {status: 'inactive', message: 'Registration stopped'});
      }

      const acknowledgements: Array<Promise<void>> = [];
      const ensureDuringDelivery = jest.fn(() => {
        acknowledgements.push(webRTCCalling.ensureWebCallingLine());
      });
      line.on(LINE_EVENTS.ERROR, ensureDuringDelivery);
      line.on(LINE_EVENTS.UNREGISTERED, ensureDuringDelivery);
      line.on(LINE_EVENTS.REGISTERED, ensureDuringDelivery);
      const lineListeners = new Map(line.handlers);
      const clientListeners = new Map(client.handlers);
      const lineListenerCount = line.on.mock.calls.length;
      const clientListenerCount = client.on.mock.calls.length;
      const lineOffCount = line.off.mock.calls.length;
      const expectRetainedOwner = () => {
        expect(createClient).toHaveBeenCalledTimes(1);
        expect(line.register).toHaveBeenCalledTimes(1);
        expect(line.deregister).not.toHaveBeenCalled();
        expect(line.on).toHaveBeenCalledTimes(lineListenerCount);
        expect(client.on).toHaveBeenCalledTimes(clientListenerCount);
        expect(line.off).toHaveBeenCalledTimes(lineOffCount);
        expect(client.off).not.toHaveBeenCalled();
        expect(line.handlers).toEqual(lineListeners);
        expect(client.handlers).toEqual(clientListeners);
        expect(mockCall.end).not.toHaveBeenCalled();
      };
      const unregisteredState = {
        status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
        lineStatus: 'unregistered',
        mobiusSocketStatus: 'not-in-use',
        reason: 'LINE_UNREGISTERED',
        retryable: true,
      };

      if (errorStatus) {
        line.emit(LINE_EVENTS.ERROR, {status: errorStatus, message: 'Keepalive failed'});
        expect(ensureDuringDelivery).toHaveBeenCalledTimes(1);
        await Promise.all(acknowledgements.splice(0));
        await flush();
        expectRetainedOwner();
        expect(webRTCCalling.getVoiceConnectionState()).toEqual(
          errorStatus === 'active'
            ? unregisteredState
            : {
                ...unregisteredState,
                lineStatus: 'error',
                reason: 'Keepalive failed',
                retryable: false,
              }
        );
      }

      line.emit(LINE_EVENTS.UNREGISTERED);
      expect(ensureDuringDelivery).toHaveBeenCalledTimes(errorStatus ? 2 : 1);
      await Promise.all(acknowledgements.splice(0));
      await flush();
      expectRetainedOwner();
      expect(webRTCCalling.getVoiceConnectionState()).toEqual(unregisteredState);

      // Calling re-registers its own line without forwarding a CONNECTING event.
      line.emit(LINE_EVENTS.REGISTERED, line);
      expect(ensureDuringDelivery).toHaveBeenCalledTimes(errorStatus ? 3 : 2);
      await Promise.all(acknowledgements);
      await flush();
      expectRetainedOwner();
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.READY,
        lineStatus: 'registered',
        mobiusSocketStatus: 'not-in-use',
      });
      await webRTCCalling.deregisterWebCallingLine();
    });

    it.each([
      {outcome: 'stopped', activeCall: false, scenario: 'terminalStoppedLineWithoutCallReplaced'},
      {outcome: 'stopped', activeCall: true, scenario: 'terminal line with an active call'},
      {outcome: 'retrying', activeCall: false, scenario: 'calling-owned retry without a call'},
      {outcome: 'retrying', activeCall: true, scenario: 'calling-owned retry with an active call'},
      {outcome: 'superseded', activeCall: false, scenario: 'superseded line without a call'},
      {outcome: 'superseded', activeCall: true, scenario: 'superseded line with an active call'},
    ])(
      'ensureLineStatusOwnershipMatrix handles UNREGISTERED: $scenario',
      async ({outcome, activeCall}) => {
        jest.useFakeTimers();
        const {line, client} = owned();
        const replacement = owned(false);
        (createClient as jest.Mock)
          .mockResolvedValueOnce(client)
          .mockResolvedValueOnce(replacement.client);
        setBrowserVoiceRequired();
        await webRTCCalling.registerWebCallingLine();
        webRTCCalling.cleanUpCall();
        client.getActiveCalls.mockReturnValue(activeCall ? {held: [mockCall]} : {});
        if (outcome === 'stopped') {
          line.emit(
            LINE_EVENTS.ERROR,
            registrationError(ERROR_TYPE.BAD_REQUEST, 'startKeepaliveTimer')
          );
        }
        const stateChangeListener = jest.fn();
        webRTCCalling.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, stateChangeListener);

        line.emit(
          LINE_EVENTS.UNREGISTERED,
          outcome === 'superseded'
            ? registrationError(ERROR_TYPE.SESSION_SUPERSEDED, 'startKeepaliveTimer')
            : undefined
        );

        const expectedState = {
          status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
          lineStatus: 'unregistered',
          mobiusSocketStatus: 'not-in-use',
          reason: 'LINE_UNREGISTERED',
          retryable: outcome !== 'superseded',
        };
        expect(webRTCCalling.getVoiceConnectionState()).toEqual(expectedState);
        expect(stateChangeListener.mock.calls).toEqual([[expectedState]]);

        await Promise.all([
          webRTCCalling.ensureWebCallingLine(),
          webRTCCalling.ensureWebCallingLine(),
        ]);
        await flush();

        const shouldReplace = outcome === 'stopped' && !activeCall;
        expect(createClient).toHaveBeenCalledTimes(shouldReplace ? 2 : 1);
        expect(line.register).toHaveBeenCalledTimes(1);
        expect(line.deregister).toHaveBeenCalledTimes(shouldReplace ? 1 : 0);
        expect(replacement.line.register).toHaveBeenCalledTimes(shouldReplace ? 1 : 0);
        expect(replacement.line.deregister).not.toHaveBeenCalled();
        expect(mockCall.end).not.toHaveBeenCalled();

        if (shouldReplace) {
          replacement.line.emit(LINE_EVENTS.REGISTERED, replacement.line);
          await flush();
          await webRTCCalling.ensureWebCallingLine();
          expect(createClient).toHaveBeenCalledTimes(2);
          expect(replacement.line.register).toHaveBeenCalledTimes(1);
          expect(replacement.line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
        } else {
          expect(webRTCCalling.getVoiceConnectionState()).toEqual(expectedState);
          expect(stateChangeListener.mock.calls).toEqual([[expectedState]]);
          expect(line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
          expect(line.handlers.get(LINE_EVENTS.REGISTERED)).toHaveLength(1);
          expect(
            client.handlers.get(CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED)
          ).toHaveLength(1);
        }

        if (activeCall) {
          client.getActiveCalls.mockReturnValue({});
          client.emit(CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED);
          client.emit(CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED);
          await flush();

          const shouldRepair = outcome === 'stopped';
          expect(createClient).toHaveBeenCalledTimes(shouldRepair ? 2 : 1);
          expect(line.deregister).toHaveBeenCalledTimes(shouldRepair ? 1 : 0);
          expect(replacement.line.register).toHaveBeenCalledTimes(shouldRepair ? 1 : 0);
          expect(mockCall.end).not.toHaveBeenCalled();

          if (shouldRepair) {
            replacement.line.emit(LINE_EVENTS.REGISTERED, replacement.line);
            await flush();
          }
        }

        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it.each(['abort', 'deregister', 'disable voice', 'superseded', 'Calling reconnect'])(
      'discards an idle repair after %s',
      async (cancelledBy) => {
        const {line, client} = owned();
        const registration = {isReconnectPending: jest.fn().mockReturnValue(false)};
        Object.assign(line, {registration});
        (createClient as jest.Mock).mockResolvedValue(client);
        setBrowserVoiceRequired();
        await webRTCCalling.registerWebCallingLine();
        client.getActiveCalls.mockReturnValue({held: [mockCall]});
        line.emit(
          LINE_EVENTS.ERROR,
          registrationError(ERROR_TYPE.BAD_REQUEST, 'startKeepaliveTimer')
        );
        line.emit(LINE_EVENTS.UNREGISTERED);
        const controller = new AbortController();
        await webRTCCalling.ensureWebCallingLine(controller.signal);
        const callsCleared = getHandler(client, CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED);

        if (cancelledBy === 'abort') controller.abort();
        if (cancelledBy === 'deregister') await webRTCCalling.deregisterWebCallingLine();
        if (cancelledBy === 'disable voice') webRTCCalling.setBrowserVoiceRequired(false);
        if (cancelledBy === 'superseded') {
          line.emit(LINE_EVENTS.UNREGISTERED, registrationError(ERROR_TYPE.SESSION_SUPERSEDED));
        }
        if (cancelledBy === 'Calling reconnect') {
          registration.isReconnectPending.mockReturnValue(true);
        }

        client.getActiveCalls.mockReturnValue({});
        expect(callsCleared).toBeDefined();
        callsCleared();
        await flush();

        expect(createClient).toHaveBeenCalledTimes(1);
        expect(line.register).toHaveBeenCalledTimes(1);
        expect(line.deregister).toHaveBeenCalledTimes(cancelledBy === 'deregister' ? 1 : 0);
        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it('absentLineEstablishesOnce and duplicateEnsureAndCancelledCreate', async () => {
      const {line, client} = owned();
      (createClient as jest.Mock).mockResolvedValue(client);
      setBrowserVoiceRequired();
      const first = new AbortController();
      await webRTCCalling.ensureWebCallingLine(first.signal);
      first.abort();
      await webRTCCalling.ensureWebCallingLine();
      await flush();
      expect(createClient).toHaveBeenCalledTimes(1);
      expect(line.register).toHaveBeenCalledTimes(1);
      expect(line.deregister).not.toHaveBeenCalled();
      expect(line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
      await webRTCCalling.deregisterWebCallingLine();
    });

    it.each([LINE_EVENTS.CONNECTING, LINE_EVENTS.RECONNECTING, LINE_EVENTS.UNREGISTERED])(
      'connectingAndReconnectingDelegate and unregisteredKeepaliveRetryDelegates: %s', async event => {
        const {line, client} = owned();
        (createClient as jest.Mock).mockResolvedValue(client);
        setBrowserVoiceRequired();
        await webRTCCalling.registerWebCallingLine();
        line.emit(event);
        await webRTCCalling.ensureWebCallingLine();
        expect(createClient).toHaveBeenCalledTimes(1);
        expect(line.register).toHaveBeenCalledTimes(1);
        expect(line.deregister).not.toHaveBeenCalled();
        await webRTCCalling.deregisterWebCallingLine();
      }
    );

    it('preserveEnsureDisabledLine and already-aborted caller start no work', async () => {
      const controller = new AbortController();
      controller.abort();
      await webRTCCalling.ensureWebCallingLine();
      setBrowserVoiceRequired();
      await webRTCCalling.ensureWebCallingLine(controller.signal);
      expect(createClient).not.toHaveBeenCalled();
      expect((webRTCCalling as any).registrationAttempt).toBeUndefined();
    });

    it.each([false, true])('supersededRegistrationDisposesOnlyOwnedCandidate: active=%s', async active => {
      const first = owned();
      const second = owned();
      const activeCall = {end: jest.fn()};
      first.client.getActiveCalls.mockReturnValue(active ? {line: [activeCall]} : {});
      let completeCreate: (client: unknown) => void;
      const firstCreate = new Promise(resolve => { completeCreate = resolve; });
      (createClient as jest.Mock).mockReturnValueOnce(firstCreate).mockResolvedValueOnce(second.client);
      setBrowserVoiceRequired();
      const firstRegistration = webRTCCalling.registerWebCallingLine();
      await flush();
      await webRTCCalling.registerWebCallingLine();
      await firstRegistration;
      completeCreate(first.client);
      await flush();
      expect(first.line.deregister).toHaveBeenCalledTimes(active ? 0 : 1);
      expect(second.line.deregister).not.toHaveBeenCalled();
      expect((webRTCCalling as any).line).toBe(second.line);
      expect(activeCall.end).not.toHaveBeenCalled();
      expect(second.line.handlers.get(LINE_EVENTS.INCOMING_CALL)).toHaveLength(1);
      await webRTCCalling.deregisterWebCallingLine();
    });
  });

});

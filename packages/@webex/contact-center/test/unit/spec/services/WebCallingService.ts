import 'jsdom-global/register';
import WebCallingService from '../../../../src/services/WebCallingService';
import {
  createClient,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  CALL_EVENT_KEYS,
  CALLING_CLIENT_EVENT_KEYS,
  LocalMicrophoneStream,
} from '@webex/calling';
import {VOICE_CONNECTION_STATUS, WebexSDK} from '../../../../src/types';
import {VOICE_CONNECTION_EVENTS} from '../../../../src/services/config/types';
import LoggerProxy from '../../../../src/logger-proxy';
import {TIMEOUT_DURATION, WEB_CALLING_SERVICE_FILE} from '../../../../src/constants';
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
      const promise = webRTCCalling.registerWebCallingLine();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
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

      getHandler(callingClient, CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED)(
        {reason: 'transient'}
      );
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

        getHandler(line, LINE_EVENTS.ERROR)({
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

    it('should detach line listeners and reset the snapshot after deregistration', async () => {
      setBrowserVoiceRequired();
      registerLineImmediately();
      await webRTCCalling.registerWebCallingLine();
      const lineHandlers = new Map(line.on.mock.calls.map(([event, handler]) => [event, handler]));

      await webRTCCalling.deregisterWebCallingLine();

      expect(line.off).toHaveBeenCalledWith(
        LINE_EVENTS.CONNECTING,
        lineHandlers.get(LINE_EVENTS.CONNECTING)
      );
      expect(line.off).toHaveBeenCalledWith(
        LINE_EVENTS.RECONNECTING,
        lineHandlers.get(LINE_EVENTS.RECONNECTING)
      );
      expect(line.off).toHaveBeenCalledWith(
        LINE_EVENTS.RECONNECTED,
        lineHandlers.get(LINE_EVENTS.RECONNECTED)
      );
      expect(line.off).toHaveBeenCalledWith(
        LINE_EVENTS.UNREGISTERED,
        lineHandlers.get(LINE_EVENTS.UNREGISTERED)
      );
      expect(line.off).toHaveBeenCalledWith(LINE_EVENTS.ERROR, lineHandlers.get(LINE_EVENTS.ERROR));
      expect(webRTCCalling.getVoiceConnectionState()).toEqual({
        status: VOICE_CONNECTION_STATUS.NOT_REQUIRED,
        lineStatus: 'unknown',
        mobiusSocketStatus: 'unknown',
      });
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
    it('should clean up the call and remove listeners', () => {
      webRTCCalling.cleanUpCall();

      expect(mockCall.off).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, expect.any(Function));
      expect(mockCall.off).toHaveBeenCalledWith(CALL_EVENT_KEYS.DISCONNECT, expect.any(Function));
      expect(webRTCCalling.call).toBeNull();
      expect(webRTCCalling.getTaskIdForCall(mockCall.getCallId())).toBeUndefined();
    });
  });
});

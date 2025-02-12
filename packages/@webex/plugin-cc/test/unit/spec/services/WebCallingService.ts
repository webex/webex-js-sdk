import 'jsdom-global/register';
import WebCallingService from '../../../../src/services/WebCallingService';
import {
  createClient,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  CALL_EVENT_KEYS,
  LocalMicrophoneStream,
} from '@webex/calling';
import { WebexSDK} from '../../../../src/types';
import LoggerProxy from '../../../../src/logger-proxy';
import {WEB_CALLING_SERVICE_FILE} from '../../../../src/constants';
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
          get: jest.fn()
        },
      },
    } as unknown as WebexSDK;

    callingClient = {
      getLines: jest.fn().mockReturnValue({
        line1: {
          on: jest.fn(),
          register: jest.fn(),
          deregister: jest.fn(),
        },
      }),
    } as unknown as ICallingClient;

    (createClient as jest.Mock).mockResolvedValue(callingClient);

    webRTCCalling = new WebCallingService(
      webex,
    );

    mockCall = {
      on: jest.fn(),
      off: jest.fn(),
      answer: jest.fn(),
      mute: jest.fn(),
      isMuted: jest.fn().mockReturnValue(true),
      end: jest.fn(),
      getCallId: jest.fn().mockReturnValue('call-id-123'),
    };

    webRTCCalling.call = mockCall;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  describe('registerWebCallingLine', () => {

    it('should register the web calling line successfully', async () => {
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

      const registeredHandler = jest.fn();
      const lineOnSpy = jest.spyOn(line, 'on').mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.REGISTERED) {
          registeredHandler.mockImplementation(handler);
          handler(deviceInfo);
        }
      });

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

      const registeredHandler = jest.fn();
      const lineOnSpy = jest.spyOn(line, 'on').mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.REGISTERED) {
          registeredHandler.mockImplementation(handler);
          handler(deviceInfo);
        }
      });
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

      const registeredHandler = jest.fn();
      const lineOnSpy = jest.spyOn(line, 'on').mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.REGISTERED) {
          registeredHandler.mockImplementation(handler);
          handler(deviceInfo);
        }
      });
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
        {module: WEB_CALLING_SERVICE_FILE}
      );

    });

    it('should reject if registration times out', async () => {
      line = callingClient.getLines().line1 as ILine;

      const promise = webRTCCalling.registerWebCallingLine();

      await expect(promise).rejects.toThrow('WebCallingService Registration timed out');
    }, 20003); // Increased timeout to 20 seconds

    it('should handle incoming calls', async () => {
      line = callingClient.getLines().line1 as ILine;

      const incomingCallHandler = jest.fn();
      const registeredHandler = jest.fn();

      const lineOnSpy = jest.spyOn(line, 'on').mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.INCOMING_CALL) {
          incomingCallHandler.mockImplementation(handler);
          handler(mockCall);
        }
        if (event === LINE_EVENTS.REGISTERED) {
          registeredHandler.mockImplementation(handler);
          handler({
            mobiusDeviceId: 'device123',
            status: 'registered',
            setError: jest.fn(),
            getError: jest.fn(),
            type: 'line',
            id: 'line1',
          });
        }
      });

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

      expect(webex.logger.info).toHaveBeenCalledWith('Call answered: task-id');
      expect(mockCall.answer).toHaveBeenCalledWith(localAudioStream);
    });

    it('should log error and throw when call.answer fails', () => {
      const error = new Error('Failed to answer');
      mockCall.answer.mockImplementation(() => {
        throw error;
      });

      expect(() => webRTCCalling.answerCall(localAudioStream, 'task-id')).toThrow(error);
      expect(webex.logger.error).toHaveBeenCalledWith(
        `Failed to answer call for task-id. Error: ${error}`
      );
    });

    it('should log when there is no call to answer', () => {
      webRTCCalling.call = null;
      webRTCCalling.answerCall(localAudioStream, 'task-id');

      expect(webex.logger.log).toHaveBeenCalledWith('Cannot answer a non WebRtc Call: task-id');
    });
  });

  describe('muteCall', () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue(['']),
      },
    };

    const localAudioStream = mockStream as unknown as LocalMicrophoneStream;

    it('should mute the call and log info when call exists', () => {
      webRTCCalling.muteCall(localAudioStream);

      expect(webex.logger.info).toHaveBeenCalledWith('Call mute or unmute requested!');
      expect(mockCall.mute).toHaveBeenCalledWith(localAudioStream);
    });

    it('should log when there is no call to mute', () => {
      webRTCCalling.call = null;
      webRTCCalling.muteCall(localAudioStream);

      expect(webex.logger.log).toHaveBeenCalledWith('Cannot mute a non WebRtc Call');
    });
  });

  describe('declineCall', () => {
    it('should end the call and log info when call exists', () => {
      webRTCCalling.declineCall('task-id');

      expect(webex.logger.info).toHaveBeenCalledWith('Call end requested: task-id');
      expect(mockCall.end).toHaveBeenCalled();
    });

    it('should log error and throw when call.end fails', () => {
      const error = new Error('Failed to end call');
      mockCall.end.mockImplementation(() => {
        throw error;
      });

      expect(() => webRTCCalling.declineCall('task-id')).toThrow(error);
      expect(webex.logger.error).toHaveBeenCalledWith(
        `Failed to end call: task-id. Error: ${error}`
      );
    });

    it('should log when there is no call to end', () => {
      webRTCCalling.call = null;
      webRTCCalling.declineCall('task-id');

      expect(webex.logger.log).toHaveBeenCalledWith('Cannot end a non WebRtc Call: task-id');
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

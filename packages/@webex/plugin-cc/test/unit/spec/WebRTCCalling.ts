import 'jsdom-global/register';
import WebRTCCalling from '../../../src/WebRTCCalling';
import {createClient, ICallingClient, ILine, LINE_EVENTS, CALL_EVENT_KEYS} from '@webex/calling';
import {WebexSDK} from '../../../src/types';

jest.mock('@webex/calling');

describe('WebRTCCalling', () => {
  let webex: WebexSDK;
  let callingClient: jest.Mocked<ICallingClient>;
  let line: jest.Mocked<ILine>;
  let webRTCCalling: WebRTCCalling;

  beforeEach(() => {
    webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
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
    } as unknown as jest.Mocked<ICallingClient>;

    (createClient as jest.Mock).mockResolvedValue(callingClient);

    webRTCCalling = new WebRTCCalling(webex, {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('registerWebCallingLine', () => {
    it('should register the web calling line successfully', async () => {
      line = callingClient.getLines().line1 as jest.Mocked<ILine>;
      const deviceInfo = {mobiusDeviceId: 'device123'};

      line.on.mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.REGISTERED) {
          handler(deviceInfo);
        }
      });

      await expect(webRTCCalling.registerWebCallingLine()).resolves.toBeUndefined();

      expect(createClient).toHaveBeenCalledWith(webex, {});
      expect(line.on).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));
      expect(line.register).toHaveBeenCalled();
      expect(webex.logger.log).toHaveBeenCalledWith(
        `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`
      );
    }, 20000); // Increased timeout to 20 seconds

    it('should reject if registration times out', async () => {
      const promise = webRTCCalling.registerWebCallingLine();
      await expect(promise).rejects.toThrow('Calling SDK Registration timed out');
    }, 20003); // Increased timeout to 20 seconds

    it('should handle incoming calls', async () => {
      line = callingClient.getLines().line1 as jest.Mocked<ILine>;
      const callObj = {on: jest.fn()} as unknown as jest.Mocked<ICall>;

      line.on.mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.INCOMING_CALL) {
          handler(callObj);
        }
        if (event === LINE_EVENTS.REGISTERED) {
          handler({mobiusDeviceId: 'device123'});
        }
      });

      await webRTCCalling.registerWebCallingLine();

      expect(line.on).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, expect.any(Function));

      const eventListener = jest.fn();
      window.addEventListener('line:incoming_call', eventListener);

      line.on.mock.calls.find((call) => call[0] === LINE_EVENTS.INCOMING_CALL)[1](callObj);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {call: callObj},
        })
      );

      const callerIdEmitter = {
        callerId: {
          name: 'John Doe',
          number: '1234567890',
          avatarSrc: 'avatar.png',
          id: 'user123',
        },
      };

      callObj.on.mockImplementation((event, handler) => {
        if (event === CALL_EVENT_KEYS.CALLER_ID) {
          handler(callerIdEmitter);
        }
      });

      callObj.on.mock.calls.find((call) => call[0] === CALL_EVENT_KEYS.CALLER_ID)[1](
        callerIdEmitter
      );

      expect(webex.logger.log).toHaveBeenCalledWith(
        `callerId : Name: ${callerIdEmitter.callerId.name}, Number: ${callerIdEmitter.callerId.number}, Avatar: ${callerIdEmitter.callerId.avatarSrc}, UserId: ${callerIdEmitter.callerId.id}`
      );
    }, 20000); // Increased timeout to 20 seconds
  });

  describe('deregisterWebCallingLine', () => {
    it('should deregister the web calling line', async () => {
      line = callingClient.getLines().line1 as jest.Mocked<ILine>;
      webRTCCalling['line'] = line; // Ensure line is set before calling deregister

      await webRTCCalling.deregisterWebCallingLine();

      expect(line.deregister).toHaveBeenCalled();
    });
  });
});

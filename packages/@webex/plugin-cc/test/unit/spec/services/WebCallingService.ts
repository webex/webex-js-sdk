import 'jsdom-global/register';
import WebCallingService from '../../../../src/services/WebCallingService';
import {
  createClient,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  ICall,
  CallingClientConfig,
} from '@webex/calling';
import {WebexSDK} from '../../../../src/types';
import config from '../../../../src/config';
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
    } as unknown as ICallingClient;

    (createClient as jest.Mock).mockResolvedValue(callingClient);

    webRTCCalling = new WebCallingService(
      webex,
      config.cc.callingClientConfig as CallingClientConfig
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  describe('registerWebCallingLine', () => {
    it('should register the web calling line successfully', async () => {
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

      expect(createClient).toHaveBeenCalledWith(webex, config.cc.callingClientConfig);
      expect(lineOnSpy).toHaveBeenCalledWith(LINE_EVENTS.REGISTERED, expect.any(Function));
      expect(line.register).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`,
        {"method": "registerWebCallingLine", "module": WEB_CALLING_SERVICE_FILE}
      );
    }, 20000); // Increased timeout to 20 seconds

    it('should reject if registration times out', async () => {
      line = callingClient.getLines().line1 as ILine;

      const promise = webRTCCalling.registerWebCallingLine();

      await expect(promise).rejects.toThrow('WebCallingService Registration timed out');
    }, 20003); // Increased timeout to 20 seconds

    it('should handle incoming calls', async () => {
      line = callingClient.getLines().line1 as ILine;
      const callObj = {on: jest.fn()} as unknown as ICall;

      const incomingCallHandler = jest.fn();
      const registeredHandler = jest.fn();

      const lineOnSpy = jest.spyOn(line, 'on').mockImplementation((event, handler) => {
        if (event === LINE_EVENTS.INCOMING_CALL) {
          incomingCallHandler.mockImplementation(handler);
          handler(callObj);
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
      const loggerSpy = jest.spyOn(webex.logger, 'log').mockClear();

      window.addEventListener('line:incoming_call', eventListener);

      line.on.mock.calls.find((call) => call[0] === LINE_EVENTS.INCOMING_CALL)[1](callObj);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {call: callObj},
        })
      );
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
});

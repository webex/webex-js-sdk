/* eslint-disable @typescript-eslint/no-shadow */
import {Mutex} from 'async-mutex';
import {createRegistration} from './register';
import {
  getMobiusDiscoveryResponse,
  getMockRequestTemplate,
  getTestUtilsWebex,
} from '../../common/testUtil';
import {
  RegistrationStatus,
  ServiceIndicator,
  WebexRequestPayload,
  WorkerMessageType,
} from '../../common/types';
import * as utils from '../../common/Utils';
import log from '../../Logger';
import {LOGGER} from '../../Logger/types';
import {URL, mockDeleteResponse, mockPostResponse} from './registerFixtures';
import {filterMobiusUris} from '../../common';
import {ERROR_TYPE} from '../../Errors/types';
import {
  DEFAULT_REHOMING_INTERVAL_MAX,
  DEFAULT_REHOMING_INTERVAL_MIN,
  FAILBACK_429_RETRY_UTIL,
  FAILBACK_UTIL,
  MINUTES_TO_SEC_MFACTOR,
  REGISTRATION_FILE,
  REG_TRY_BACKUP_TIMER_VAL_FOR_CC_IN_SEC,
  REG_TRY_BACKUP_TIMER_VAL_IN_SEC,
  SEC_TO_MSEC_MFACTOR,
} from '../constants';
import {ICall} from '../calling/types';
import {LINE_EVENTS} from '../line/types';
import {createLineError} from '../../Errors/catalog/LineError';
import {IRegistration} from './types';

const webex = getTestUtilsWebex();
const MockServiceData = {
  indicator: ServiceIndicator.CALLING,
  domain: '',
};
const logSpy = jest.spyOn(log, 'info');
const warnSpy = jest.spyOn(log, 'warn');
const handleErrorSpy = jest.spyOn(utils, 'handleRegistrationErrors');

Object.defineProperty(global, 'import', {
  value: {
    meta: {
      url: 'http://test.url/mockWebWorker.ts',
    },
  },
});

describe('Registration Tests', () => {
  const originalProcessNextTick = process.nextTick;
  function flushPromises() {
    return new Promise((resolve) => {
      originalProcessNextTick(resolve);
    });
  }

  const lineEmitter = jest.fn();

  const mobiusUris = filterMobiusUris(getMobiusDiscoveryResponse(), URL);

  const mockResponse = {
    ...getMockRequestTemplate(),
    uri: `${mobiusUris.primary[0]}device`,
    body: {
      userId: webex.internal.device.userId,
      clientDeviceUri: webex.internal.device.url,
      serviceData: {
        domain: '',
        indicator: 'calling',
      },
    },
  };

  const ccMockResponse = {
    ...mockResponse,
    body: {
      ...mockResponse.body,
      serviceData: {
        domain: '',
        indicator: 'contactcenter',
      },
    },
  };

  const failurePayload = <WebexRequestPayload>(<unknown>{
    statusCode: 500,
    body: mockPostResponse,
  });

  const failurePayload429 = <WebexRequestPayload>(<unknown>{
    statusCode: 429,
    body: mockPostResponse,
  });

  const successPayload = <WebexRequestPayload>(<unknown>{
    statusCode: 200,
    body: mockPostResponse,
  });

  let reg: IRegistration;
  let restartSpy;
  let failbackRetry429Spy;
  let restoreSpy;
  let postRegistrationSpy;

  const setupRegistration = (mockServiceData) => {
    const mutex = new Mutex();
    reg = createRegistration(webex, mockServiceData, mutex, lineEmitter, LOGGER.INFO);
    reg.setMobiusServers(mobiusUris.primary, mobiusUris.backup);
    jest.clearAllMocks();
    restartSpy = jest.spyOn(reg, 'restartRegistration');
    failbackRetry429Spy = jest.spyOn(reg, FAILBACK_429_RETRY_UTIL);
    restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
    postRegistrationSpy = jest.spyOn(reg, 'postRegistration');
  };

  beforeEach(() => {
    setupRegistration(MockServiceData);
  });

  afterEach(() => {
    webex.request = jest.fn();
    jest.clearAllTimers();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('verify successful registration', async () => {
    webex.request.mockReturnValueOnce({
      body: mockPostResponse,
    });

    await reg.triggerRegistration();

    expect(webex.request).toBeCalledOnceWith({
      ...mockResponse,
      method: 'POST',
    });

    expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
    expect(lineEmitter).toBeCalledTimes(2);
    expect(lineEmitter).toBeCalledWith(LINE_EVENTS.CONNECTING);
    expect(lineEmitter).toBeCalledWith(LINE_EVENTS.REGISTERED, mockPostResponse);
  });

  it('verify failure registration', async () => {
    webex.request.mockRejectedValue({
      body: mockPostResponse,
      statusCode: 401,
    });

    await reg.triggerRegistration();

    expect(webex.request).toBeCalledOnceWith({
      ...mockResponse,
      method: 'POST',
    });

    const error = createLineError(
      'User is unauthorized due to an expired token. Sign out, then sign back in.',
      {},
      ERROR_TYPE.TOKEN_ERROR,
      RegistrationStatus.INACTIVE
    );

    expect(reg.getStatus()).toEqual(RegistrationStatus.INACTIVE);
    expect(lineEmitter).toBeCalledTimes(2);
    expect(lineEmitter).nthCalledWith(1, LINE_EVENTS.CONNECTING);
    expect(lineEmitter).nthCalledWith(2, LINE_EVENTS.ERROR, undefined, error);
  });

  it('verify failure registration 403-101', async () => {
    webex.request
      .mockRejectedValueOnce({
        body: {
          userId: mockPostResponse.userId,
          errorCode: 101,
          devices: [mockPostResponse.device],
        },
        statusCode: 403,
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: mockPostResponse,
      });

    global.fetch = jest.fn(() => Promise.resolve({json: () => mockDeleteResponse})) as jest.Mock;

    expect(reg.getStatus()).toEqual(RegistrationStatus.IDLE);
    await reg.triggerRegistration();
    expect(webex.request).toBeCalledTimes(2);
    expect(webex.request).toBeCalledWith({
      ...mockResponse,
      method: 'POST',
    });
    expect(global.fetch).toBeCalledOnceWith(mockPostResponse.device.uri, {
      method: 'DELETE',
      headers: expect.anything(),
    });

    expect(warnSpy).toBeCalledWith('User device limit exceeded', expect.anything());
    expect(logSpy).toBeCalledWith('Registration restoration in progress.', expect.anything());
    expect(logSpy).toBeCalledWith('Registration restored successfully.', expect.anything());

    expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
    expect(lineEmitter).toBeCalledTimes(4);
    expect(lineEmitter).nthCalledWith(1, LINE_EVENTS.CONNECTING);
    expect(lineEmitter).nthCalledWith(2, LINE_EVENTS.UNREGISTERED);
    expect(lineEmitter).nthCalledWith(3, LINE_EVENTS.CONNECTING);
    expect(lineEmitter).nthCalledWith(4, LINE_EVENTS.REGISTERED, mockPostResponse);
  });

  describe('Registration failover tests', () => {
    it('verify unreachable primary with reachable backup servers', async () => {
      jest.useFakeTimers();
      // try the primary twice and register successfully with backup servers
      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(successPayload);

      expect(reg.getStatus()).toEqual(RegistrationStatus.IDLE);
      await reg.triggerRegistration();
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(webex.request).toBeCalledTimes(3);
      expect(webex.request).toBeCalledWith({
        ...mockResponse,
        method: 'POST',
        uri: `${mobiusUris.primary[0]}device`,
      });
      expect(webex.request).toBeCalledWith({
        ...mockResponse,
        method: 'POST',
        uri: `${mobiusUris.backup[0]}device`,
      });
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      /* Active Url must match with the backup url as per the test */
      expect(reg.getActiveMobiusUrl()).toEqual(mobiusUris.backup[0]);
    });

    it('cc: verify unreachable primary with reachable backup server', async () => {
      setupRegistration({...MockServiceData, indicator: ServiceIndicator.CONTACT_CENTER});

      jest.useFakeTimers();
      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(successPayload);

      expect(reg.getStatus()).toEqual(RegistrationStatus.IDLE);
      await reg.triggerRegistration();
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_FOR_CC_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(webex.request).toBeCalledTimes(3);
      expect(webex.request).toBeCalledWith({
        ...ccMockResponse,
        method: 'POST',
        uri: `${mobiusUris.primary[0]}device`,
      });
      expect(webex.request).toBeCalledWith({
        ...ccMockResponse,
        method: 'POST',
        uri: `${mobiusUris.backup[0]}device`,
      });
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      /* Active Url must match with the backup url as per the test */
      expect(reg.getActiveMobiusUrl()).toEqual(mobiusUris.backup[0]);
    });

    it('verify unreachable primary and backup servers', async () => {
      jest.useFakeTimers();
      // try the primary twice and register successfully with backup servers
      webex.request.mockRejectedValue(failurePayload);

      expect(reg.getStatus()).toEqual(RegistrationStatus.IDLE);
      await reg.triggerRegistration();
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      /*
       * 2 calls for primary -> initial and after timer expiry.
       * 2 calls for each backup entry -> 2 * 2 = 4.
       * So a total of 6 calls to webex.request and handleErrors
       */
      expect(webex.request).toBeCalledTimes(6);
      expect(handleErrorSpy).toBeCalledTimes(6);
      expect(webex.request).toBeCalledWith({
        ...mockResponse,
        method: 'POST',
        uri: `${mobiusUris.primary[0]}device`,
      });
      expect(webex.request).toBeCalledWith({
        ...mockResponse,
        method: 'POST',
        uri: `${mobiusUris.backup[0]}device`,
      });
      expect(webex.request).toBeCalledWith({
        ...mockResponse,
        method: 'POST',
        uri: `${mobiusUris.backup[1]}device`,
      });
      expect(reg.getStatus()).toEqual(RegistrationStatus.INACTIVE);
    });
  });

  describe('Registration failback tests', () => {
    beforeEach(async () => {
      /* keep keepalive as active so that it wont interfere with the failback tests */
      jest.useFakeTimers();
      postRegistrationSpy
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(successPayload);

      await reg.triggerRegistration();

      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();
      reg.rehomingIntervalMin = DEFAULT_REHOMING_INTERVAL_MIN;
      reg.rehomingIntervalMax = DEFAULT_REHOMING_INTERVAL_MAX;

      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);

      /* Active Url must match with the backup url as per the test */
      expect(reg.getActiveMobiusUrl()).toStrictEqual(mobiusUris.backup[0]);
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
    });

    it('verify 429 error with failback to primary after initial registration with backup: Restore failure', async () => {
      // delete should be successful
      global.fetch = jest.fn(() => Promise.resolve({json: () => mockDeleteResponse})) as jest.Mock;

      postRegistrationSpy.mockRejectedValue(failurePayload429);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        reg.rehomingIntervalMax * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(logSpy).toBeCalledWith(`Attempting failback to primary.`, {
        method: 'executeFailback',
        file: REGISTRATION_FILE,
      });

      expect(failbackRetry429Spy).toBeCalledOnceWith();
      expect(reg.failback429RetryAttempts).toBe(0);
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_429_RETRY_UTIL);
      expect(restartSpy).toBeCalledOnceWith(FAILBACK_429_RETRY_UTIL);
      expect(reg.failbackTimer).toBe(undefined);
      expect(reg.rehomingIntervalMin).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(reg.rehomingIntervalMax).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify unsuccessful failback to primary after initial registration with backup: Restore failure', async () => {
      postRegistrationSpy.mockRejectedValue(failurePayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        reg.rehomingIntervalMax * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(logSpy).toBeCalledWith(`Attempting failback to primary.`, {
        method: 'executeFailback',
        file: REGISTRATION_FILE,
      });
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(restartSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(reg.rehomingIntervalMin).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(reg.rehomingIntervalMax).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify unsuccessful failback to primary after initial registration with backup: Restore failure with final error', async () => {
      const finalErrorPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 401,
        body: mockPostResponse,
      });
      postRegistrationSpy.mockClear();
      postRegistrationSpy
        .mockRejectedValue(finalErrorPayload)
        .mockRejectedValueOnce(failurePayload);
      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        reg.rehomingIntervalMax * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(logSpy).toBeCalledWith(`Attempting failback to primary.`, {
        method: 'executeFailback',
        file: REGISTRATION_FILE,
      });
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(restartSpy).not.toBeCalled();
      expect(reg.failbackTimer).toBe(undefined);
      expect(reg.rehomingIntervalMin).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(reg.rehomingIntervalMax).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify unsuccessful failback to primary after initial registration with backup: Restore success', async () => {
      postRegistrationSpy.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        reg.rehomingIntervalMax * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(logSpy).toBeCalledWith(`Attempting failback to primary.`, {
        method: 'executeFailback',
        file: REGISTRATION_FILE,
      });
      /* Active Url should still match backup url */
      expect(reg.getActiveMobiusUrl()).toStrictEqual(mobiusUris.backup[0]);
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(restartSpy).not.toBeCalled();
      expect(reg.rehomingIntervalMin).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(reg.rehomingIntervalMax).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify successful failback to primary after initial registration with backup', async () => {
      postRegistrationSpy.mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        reg.rehomingIntervalMax * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(logSpy).toBeCalledWith(`Attempting failback to primary.`, {
        method: 'executeFailback',
        file: REGISTRATION_FILE,
      });

      /* Active Url must now match with the primary url */
      expect(reg.getActiveMobiusUrl()).toStrictEqual(mobiusUris.primary[0]);
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(reg.failbackTimer).toBe(undefined);
      expect(restoreSpy).not.toBeCalled();
      expect(reg.rehomingIntervalMin).toBe(mockPostResponse.rehomingIntervalMin);
      expect(reg.rehomingIntervalMax).toBe(mockPostResponse.rehomingIntervalMax);
    });

    it('verify unsuccessful failback attempt due to active call', async () => {
      /** create a new call */
      reg.callManager.createCall();
      expect(Object.keys(reg.callManager.getActiveCalls()).length).toBe(1);

      postRegistrationSpy.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        reg.rehomingIntervalMax * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(logSpy).toBeCalledWith(`Active calls present, deferring failback to next cycle.`, {
        method: 'executeFailback',
        file: REGISTRATION_FILE,
      });

      /* Active Url should still match backup url */
      expect(reg.getActiveMobiusUrl()).toStrictEqual(mobiusUris.backup[0]);
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(restoreSpy).not.toBeCalled();
      expect(restartSpy).not.toBeCalled();

      expect(logSpy).toBeCalledWith('Active calls present, deferring failback to next cycle.', {
        file: REGISTRATION_FILE,
        method: FAILBACK_UTIL,
      });
      expect(reg.rehomingIntervalMin).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(reg.rehomingIntervalMax).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });
  });

  // Keep-alive related test cases
  describe('Keep-alive Tests', () => {
    const beforeEachSetupForKeepalive = async () => {
      postRegistrationSpy.mockResolvedValueOnce(successPayload);
      jest.useFakeTimers();
      await reg.triggerRegistration();
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(reg.webWorker).toBeDefined();
    };

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();

      reg.clearKeepaliveTimer();
      reg.reconnectPending = false;
      const calls = Object.values(reg.callManager.getActiveCalls()) as ICall[];

      calls.forEach((call) => {
        call.end();
      });
    });

    it('verify successful keep-alive cases', async () => {
      const postMessageSpy = jest.spyOn(Worker.prototype, 'postMessage');

      await beforeEachSetupForKeepalive();

      expect(reg.webWorker).toBeDefined();
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START_KEEPALIVE',
          accessToken: expect.any(String),
          deviceUrl: expect.any(String),
          interval: expect.any(Number),
          retryCountThreshold: expect.any(Number),
          url: expect.any(String),
        })
      );

      reg.webWorker.onmessage({
        data: {type: 'KEEPALIVE_SUCCESS', statusCode: 200},
      } as MessageEvent);

      expect(lineEmitter).toBeCalledWith(LINE_EVENTS.RECONNECTED);
    });

    it('verify failure keep-alive cases: Retry Success', async () => {
      await beforeEachSetupForKeepalive();

      const worker = reg.webWorker;
      lineEmitter.mockClear();

      worker.onmessage({
        data: {type: 'KEEPALIVE_FAILURE', err: {statusCode: 503}, keepAliveRetryCount: 1},
      } as MessageEvent);

      worker.onmessage({
        data: {type: 'KEEPALIVE_SUCCESS', statusCode: 200},
      } as MessageEvent);

      expect(lineEmitter).toHaveBeenCalledWith(LINE_EVENTS.RECONNECTED);
    });

    it('verify failure keep-alive cases: Restore failure', async () => {
      // Run any necessary setup for keepalive
      await beforeEachSetupForKeepalive();
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');

      // Clear previous event emissions
      lineEmitter.mockClear();

      // Assume registration is active
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);

      // Use fake timers to trigger keepalive initialization
      jest.useFakeTimers();
      jest.advanceTimersByTime(mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);

      // Simulate the worker sending a KEEPALIVE_FAILURE message with retry count at threshold.
      const RETRY_COUNT_THRESHOLD = reg.isCCFlow ? 4 : 5;
      const failureEvent = {
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: {statusCode: 503},
          keepAliveRetryCount: RETRY_COUNT_THRESHOLD,
        },
      };

      reg.webWorker.onmessage(failureEvent);
      await flushPromises();

      expect(reg.getStatus()).toEqual(RegistrationStatus.INACTIVE);
      expect(lineEmitter).toHaveBeenCalledWith(LINE_EVENTS.UNREGISTERED);
      expect(reconnectSpy).toBeCalledOnceWith('startKeepaliveTimer');

      jest.useRealTimers();
    });

    it('verify failure keep-alive cases: Restore Success', async () => {
      await beforeEachSetupForKeepalive();
      expect(reg.webWorker).toBeDefined();

      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');
      const url = 'https://mobius-dfw.webex.com/api/v1/calling/web/';

      reg.webWorker.onmessage({
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: {statusCode: 503},
          keepAliveRetryCount: 5,
        },
      } as MessageEvent);

      jest.advanceTimersByTime(1000);
      await flushPromises();

      expect(reg.webWorker).toBeUndefined();
      expect(reconnectSpy).toBeCalledOnceWith(reg.startKeepaliveTimer.name);

      webex.request.mockResolvedValueOnce(successPayload);
      await reg.triggerRegistration();
      await flushPromises();
      expect(reg.webWorker).toBeDefined();

      reg.webWorker.onmessage({
        data: {type: WorkerMessageType.KEEPALIVE_SUCCESS, statusCode: 200},
      } as MessageEvent);

      // Advance timers and flush any remaining promises.
      jest.advanceTimersByTime(1000);
      await flushPromises();

      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      // reconnectSpy should have been called only once.
      expect(reconnectSpy).toBeCalledTimes(1);
      expect(restoreSpy).toBeCalledOnceWith(reg.startKeepaliveTimer.name);
      expect(restartSpy).toBeCalledOnceWith(reg.startKeepaliveTimer.name);
      // Active Mobius URL should remain unchanged.
      expect(reg.getActiveMobiusUrl()).toStrictEqual(url);
    });

    it('verify failure followed by recovery of keepalive', async () => {
      await beforeEachSetupForKeepalive();
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(reg.webWorker).toBeDefined();

      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      reg.webWorker.onmessage({
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: failurePayload,
          keepAliveRetryCount: reg.isCCFlow ? 4 : 5,
        },
      } as MessageEvent);
      await flushPromises();

      expect(reg.webWorker).toBeUndefined();
      expect(handleErrorSpy).toBeCalledTimes(3);

      await reg.triggerRegistration();
      await flushPromises();
      expect(reg.webWorker).toBeDefined();

      reg.webWorker.onmessage({
        data: {type: WorkerMessageType.KEEPALIVE_SUCCESS, statusCode: 200},
      } as MessageEvent);
      await flushPromises();

      // In a complete failure‐then-recovery scenario, we expect another failure event to have been handled.
      // For that, simulate a second failure event on the new worker.
      reg.webWorker.onmessage({
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: failurePayload,
          keepAliveRetryCount: reg.isCCFlow ? 4 : 5,
        },
      } as MessageEvent);
      await flushPromises();

      expect(handleErrorSpy).toBeCalledTimes(4);

      // And then re-register successfully:
      await reg.triggerRegistration();
      await flushPromises();
      expect(reg.webWorker).toBeDefined();

      reg.webWorker.onmessage({
        data: {type: WorkerMessageType.KEEPALIVE_SUCCESS, statusCode: 200},
      } as MessageEvent);
      await flushPromises();

      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      expect(reg.webWorker).toBeDefined();
    });

    it('cc: verify failover to backup server after 4 keep alive failure with primary server', async () => {
      // Register with contact center service
      setupRegistration({...MockServiceData, indicator: ServiceIndicator.CONTACT_CENTER});
      await beforeEachSetupForKeepalive();

      webex.request.mockResolvedValueOnce(successPayload);
      await reg.triggerRegistration();

      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      expect(reg.webWorker).toBeDefined();

      // Spy on clearKeepaliveTimer and simulate reconnectOnFailure behavior
      const clearKeepaliveSpy = jest.spyOn(reg, 'clearKeepaliveTimer');
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');

      // Simulate a KEEPALIVE_FAILURE message from the worker with a retry count equal to threshold (4 for CC)
      reg.webWorker.onmessage({
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: {statusCode: 503},
          keepAliveRetryCount: 4,
        },
      } as MessageEvent);

      // Wait for any asynchronous actions to complete
      await flushPromises();

      // Verify that the keepalive timer was cleared and reconnectOnFailure was triggered
      expect(clearKeepaliveSpy).toHaveBeenCalled();
      expect(reconnectSpy).toHaveBeenCalledWith(reg.startKeepaliveTimer.name);

      // Verify that the active Mobius URL has been updated to the backup server and registration is active
      expect(reg.getActiveMobiusUrl()).toEqual(mobiusUris.backup[0]);
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
    });

    it('verify final error for keep-alive', async () => {
      await beforeEachSetupForKeepalive();
      const threshold = reg.isCCFlow ? 4 : 5;
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');
      jest.spyOn(utils, 'handleRegistrationErrors').mockResolvedValue(true);

      reg.webWorker.onmessage({
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: {statusCode: 404},
          keepAliveRetryCount: threshold,
        },
      } as MessageEvent);
      await flushPromises();

      expect(reg.getStatus()).toEqual(RegistrationStatus.INACTIVE);
      expect(lineEmitter).toHaveBeenCalledWith(LINE_EVENTS.UNREGISTERED);
      expect(reconnectSpy).not.toHaveBeenCalled();
    });

    it('verify failure keep-alive case with active call present: Restore Success after call ends', async () => {
      await beforeEachSetupForKeepalive();
      // Simulate an active call.
      reg.callManager.createCall();
      expect(Object.keys(reg.callManager.getActiveCalls()).length).toBeGreaterThan(0);
      const clearTimerSpy = jest.spyOn(reg, 'clearKeepaliveTimer');

      const threshold = reg.isCCFlow ? 4 : 5;

      // Simulate a KEEPALIVE_FAILURE event with a 503 error at threshold.
      const failureEvent = {
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: {statusCode: 503},
          keepAliveRetryCount: threshold,
        },
      } as MessageEvent;
      reg.webWorker.onmessage(failureEvent);
      await flushPromises();

      // At this point, clearKeepaliveTimer was called so the worker is terminated.
      expect(clearTimerSpy).toHaveBeenCalled();
      expect(reg.getStatus()).toEqual(RegistrationStatus.INACTIVE);
      expect(reg.webWorker).toBeUndefined();

      // Now simulate call cleanup.
      reg.callManager.callCollection = {};
      webex.request.mockResolvedValueOnce(successPayload);

      // Call reconnectOnFailure manually. With no active calls, this should trigger re-registration.
      await reg.reconnectOnFailure('activeCallEnded');
      await flushPromises();

      // After re-registration, registration status becomes ACTIVE and a new worker is created.
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      expect(reg.isReconnectPending()).toBe(false);
      expect(reg.webWorker).toBeDefined();
    });

    it('should emit LINE_EVENTS.ERROR when keepalive fails with a final error', async () => {
      await beforeEachSetupForKeepalive();
      expect(reg.webWorker).toBeDefined();
      lineEmitter.mockClear();

      jest
        .spyOn(utils, 'handleRegistrationErrors')
        .mockImplementationOnce(async (error, callback) => {
          const clientError = createLineError(
            'User is unauthorized due to an expired token. Sign out, then sign back in.',
            {},
            ERROR_TYPE.TOKEN_ERROR,
            RegistrationStatus.INACTIVE
          );
          callback(clientError, true);

          return true;
        });

      reg.webWorker.onmessage({
        data: {
          type: WorkerMessageType.KEEPALIVE_FAILURE,
          err: {
            statusCode: 401,
            message: 'Unauthorized',
          },
          keepAliveRetryCount: 1,
        },
      } as MessageEvent);

      await flushPromises();
      expect(lineEmitter).toHaveBeenNthCalledWith(
        1,
        LINE_EVENTS.ERROR,
        undefined,
        new Error('User is unauthorized due to an expired token. Sign out, then sign back in.')
      );
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(reg.webWorker).toBeUndefined();
    });
  });
});

/* eslint-disable @typescript-eslint/no-shadow */
import {Mutex} from 'async-mutex';
import {createRegistration} from './register';
import {
  getMobiusDiscoveryResponse,
  getMockRequestTemplate,
  getTestUtilsWebex,
} from '../../common/testUtil';
import {RegistrationStatus, ServiceIndicator, WebexRequestPayload} from '../../common/types';
import * as utils from '../../common/Utils';
import log from '../../Logger';
import {LOGGER} from '../../Logger/types';
import {URL, mockDeleteResponse, mockPostResponse} from './registerFixtures';
import {filterMobiusUris} from '../../common';
import {ERROR_TYPE} from '../../Errors/types';
import {
  CALLS_CLEARED_HANDLER_UTIL,
  DEFAULT_REHOMING_INTERVAL_MAX,
  DEFAULT_REHOMING_INTERVAL_MIN,
  FAILBACK_429_RETRY_UTIL,
  FAILBACK_UTIL,
  KEEPALIVE_UTIL,
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
      jest.spyOn(reg, 'postKeepAlive').mockResolvedValue(successPayload);
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
    const logObj = {
      file: REGISTRATION_FILE,
      method: 'startKeepaliveTimer',
    };
    const mockKeepAliveBody = {device: mockPostResponse.device};

    const beforeEachSetupForKeepalive = async () => {
      postRegistrationSpy.mockResolvedValueOnce(successPayload);
      jest.useFakeTimers();
      await reg.triggerRegistration();
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
    };

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();

      if (reg.keepaliveTimer) {
        clearInterval(reg.keepaliveTimer);
        reg.keepaliveTimer = undefined;
      }
      reg.reconnectPending = false;
      const calls = Object.values(reg.callManager.getActiveCalls()) as ICall[];

      calls.forEach((call) => {
        call.end();
      });
    });

    it('verify successful keep-alive cases', async () => {
      await beforeEachSetupForKeepalive();
      const keepAlivePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      webex.request.mockReturnValue(keepAlivePayload);

      const funcSpy = jest.spyOn(reg, 'postKeepAlive');

      jest.advanceTimersByTime(2 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();
      expect(funcSpy).toBeCalledTimes(2); // should be called 2 times: first try and after the interval.
      expect(logSpy).lastCalledWith('Sent Keepalive, status: 200', logObj);
    });

    it('verify failure keep-alive cases: Retry Success', async () => {
      await beforeEachSetupForKeepalive();
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });
      const successPayload = {
        statusCode: 200,
        body: mockKeepAliveBody,
      };

      const timer = reg.keepaliveTimer;

      lineEmitter.mockClear();
      webex.request.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      jest.advanceTimersByTime(2 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(handleErrorSpy).toBeCalledOnceWith(failurePayload, expect.anything(), {
        method: 'startKeepaliveTimer',
        file: REGISTRATION_FILE,
      });

      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(reg.keepaliveTimer).toBe(timer);
      expect(lineEmitter).nthCalledWith(1, LINE_EVENTS.RECONNECTING);
      expect(lineEmitter).nthCalledWith(2, LINE_EVENTS.RECONNECTED);
      expect(lineEmitter).toBeCalledTimes(2);
    });

    it('verify failure keep-alive cases: Restore failure', async () => {
      await beforeEachSetupForKeepalive();
      const restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(reg, 'restartRegistration');
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      lineEmitter.mockClear();

      webex.request.mockRejectedValue(failurePayload);

      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);

      const timer = reg.keepaliveTimer;

      jest.advanceTimersByTime(5 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(clearIntervalSpy).toBeCalledOnceWith(timer);

      // sendKeepAlive tries to retry 5 times before accepting failure
      // later 2 attempts to register with primary server
      expect(handleErrorSpy).toBeCalledTimes(7);
      expect(reg.getStatus()).toEqual(RegistrationStatus.INACTIVE);
      expect(reg.reconnectPending).toStrictEqual(false);
      expect(reconnectSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restoreSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restartRegSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);

      expect(webex.request).toBeCalledTimes(7);
      expect(reg.keepaliveTimer).toBe(undefined);
      expect(lineEmitter).nthCalledWith(1, LINE_EVENTS.RECONNECTING);
      expect(lineEmitter).nthCalledWith(4, LINE_EVENTS.RECONNECTING);
      expect(lineEmitter).nthCalledWith(5, LINE_EVENTS.UNREGISTERED);

      /** there will be 2 registration attempts */
      expect(lineEmitter).nthCalledWith(6, LINE_EVENTS.CONNECTING);
      expect(lineEmitter).nthCalledWith(7, LINE_EVENTS.UNREGISTERED);
      expect(lineEmitter).nthCalledWith(8, LINE_EVENTS.CONNECTING);
      expect(lineEmitter).nthCalledWith(9, LINE_EVENTS.UNREGISTERED);
      expect(lineEmitter).toBeCalledTimes(9);
    });

    it('verify failure keep-alive cases: Restore Success', async () => {
      await beforeEachSetupForKeepalive();
      const restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(reg, 'restartRegistration');
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      /* successful registration */
      // webex.request.mockResolvedValue(successPayload);

      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);

      const url = 'https://mobius.asydm-m-1.prod.infra.webex.com/api/v1';

      /* set active Url and expect the registration to restore to this url */
      reg.setActiveMobiusUrl(url);

      const timer = reg.keepaliveTimer;

      jest.advanceTimersByTime(5 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(clearIntervalSpy).toBeCalledOnceWith(timer);
      expect(handleErrorSpy).toBeCalledTimes(5);
      expect(reg.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      expect(reconnectSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restoreSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restartRegSpy).not.toBeCalled();
      expect(reg.getActiveMobiusUrl()).toStrictEqual(url);
      expect(reg.reconnectPending).toStrictEqual(false);
      expect(reg.keepaliveTimer).toBeTruthy();
      expect(reg.keepaliveTimer).not.toBe(timer);
    });

    it('verify failure followed by recovery of keepalive', async () => {
      await beforeEachSetupForKeepalive();
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);

      const timer = reg.keepaliveTimer;

      // sendKeepAlive tries to retry 3 times and receiving success on third time
      jest.advanceTimersByTime(3 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(webex.request).toBeCalledTimes(3);
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(handleErrorSpy).toBeCalledTimes(2);
      expect(clearIntervalSpy).not.toBeCalled();
      expect(reg.keepaliveTimer).toBe(timer);
    });

    it('cc: verify failover to backup server after 4 keep alive failure with primary server', async () => {
      // Register with contact center service
      setupRegistration({...MockServiceData, indicator: ServiceIndicator.CONTACT_CENTER});
      await beforeEachSetupForKeepalive();

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      jest
        .spyOn(reg, 'postKeepAlive')
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);

      const timer = reg.keepaliveTimer;

      jest.advanceTimersByTime(5 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(clearIntervalSpy).toBeCalledOnceWith(timer);
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(reg.keepaliveTimer).not.toBe(timer);

      webex.request.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_FOR_CC_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      /* Active Url must match with the backup url as per the test */
      expect(reg.getActiveMobiusUrl()).toEqual(mobiusUris.backup[0]);
      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
    });

    it('verify final error for keep-alive', async () => {
      await beforeEachSetupForKeepalive();
      const restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(reg, 'restartRegistration');
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 404,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      webex.request.mockRejectedValue(failurePayload);

      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);

      /* send one keepalive */
      jest.advanceTimersByTime(mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(clearIntervalSpy).toBeCalledTimes(1);
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(reconnectSpy).not.toBeCalled();
      expect(restoreSpy).not.toBeCalled();
      expect(restartRegSpy).not.toBeCalled();
      expect(reg.reconnectPending).toStrictEqual(false);
      expect(webex.request).toBeCalledOnceWith({
        headers: mockResponse.headers,
        uri: `${mockKeepAliveBody.device.uri}/status`,
        method: 'POST',
        service: mockResponse.service,
      });
      expect(reg.keepaliveTimer).toBe(undefined);
      expect(handleErrorSpy).toBeCalledOnceWith(failurePayload, expect.anything(), {
        file: REGISTRATION_FILE,
        method: KEEPALIVE_UTIL,
      });
    });

    it('verify failure keep-alive case with active call present: Restore Success after call ends', async () => {
      await beforeEachSetupForKeepalive();
      const restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(reg, 'restartRegistration');
      const reconnectSpy = jest.spyOn(reg, 'reconnectOnFailure');
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });

      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      // jest.spyOn(callingClient['registration'], 'createDevice').mockResolvedValue(successPayload);

      const url = 'https://mobius.asydm-m-1.prod.infra.webex.com/api/v1';

      reg.setActiveMobiusUrl(url);

      expect(reg.reconnectPending).toStrictEqual(false);

      const timer = reg.keepaliveTimer;

      /* add a call to the callManager */
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const call = reg.callManager.createCall();

      expect(Object.keys(reg.callManager.getActiveCalls()).length).toBe(1);

      /* send one keepalive */
      jest.advanceTimersByTime(5 * mockPostResponse.keepaliveInterval * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(clearIntervalSpy).toBeCalledOnceWith(timer);
      expect(handleErrorSpy).toBeCalledTimes(5);
      expect(reg.keepaliveTimer).toStrictEqual(undefined);
      expect(reg.failbackTimer).toStrictEqual(undefined);
      expect(reg.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(lineEmitter).lastCalledWith(LINE_EVENTS.UNREGISTERED);
      expect(reconnectSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restoreSpy).not.toBeCalled();
      expect(restartRegSpy).not.toBeCalled();
      expect(reg.reconnectPending).toStrictEqual(true);
      expect(logSpy).toBeCalledWith(
        'Active call(s) present, deferred reconnect till call cleanup.',
        {file: REGISTRATION_FILE, method: expect.any(String)}
      );

      reconnectSpy.mockClear();

      /* simulate call disconnect and Calling client will trigger reconnect upon receiving disconnect event from CallManager */
      reg.callManager.callCollection = {};
      await reg.reconnectOnFailure(CALLS_CLEARED_HANDLER_UTIL);
      expect(Object.keys(reg.callManager.getActiveCalls()).length).toBe(0);

      expect(reg.getStatus()).toBe(RegistrationStatus.ACTIVE);
      expect(reconnectSpy).toBeCalledOnceWith(CALLS_CLEARED_HANDLER_UTIL);
      expect(restoreSpy).toBeCalledOnceWith(CALLS_CLEARED_HANDLER_UTIL);
      expect(restartRegSpy).not.toBeCalled();
      expect(reg.reconnectPending).toStrictEqual(false);
      expect(reg.getActiveMobiusUrl()).toStrictEqual(url);
      expect(reg.keepaliveTimer).toBeTruthy();
      expect(reg.keepaliveTimer).not.toBe(timer);
    });
  });
});

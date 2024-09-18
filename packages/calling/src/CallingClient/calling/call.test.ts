/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable dot-notation */
/* eslint-disable @typescript-eslint/no-shadow */
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import {EffectEvent} from '@webex/web-media-effects';
import {ERROR_TYPE, ERROR_LAYER} from '../../Errors/types';
import * as Utils from '../../common/Utils';
import {CALL_EVENT_KEYS, CallEvent, RoapEvent, RoapMessage} from '../../Events/types';
import {DEFAULT_SESSION_TIMER, ICE_CANDIDATES_TIMEOUT} from '../constants';
import {CallDirection, CallType, ServiceIndicator, WebexRequestPayload} from '../../common/types';
import {METRIC_EVENT, TRANSFER_ACTION, METRIC_TYPE} from '../../Metrics/types';
import {Call, createCall} from './call';
import {
  MobiusCallState,
  DisconnectCause,
  DisconnectCode,
  ICallManager,
  MediaContext,
  MidCallEvent,
  CallRtpStats,
  SSResponse,
  TransferType,
} from './types';
import {mediaConnection, getTestUtilsWebex, flushPromises} from '../../common/testUtil';
import {getCallManager} from './callManager';
import {waitForMsecs} from '../../common/Utils';
import log from '../../Logger';
import {CallError} from '../../Errors';

jest.mock('@webex/internal-media-core');

const webex = getTestUtilsWebex();

const mockInternalMediaCoreModule = InternalMediaCoreModule as jest.Mocked<
  typeof InternalMediaCoreModule
>;

const defaultServiceIndicator = ServiceIndicator.CALLING;
const activeUrl = 'FakeActiveUrl';
const mockLineId = 'e4e8ee2a-a154-4e52-8f11-ef4cde2dce72';

describe('Call Tests', () => {
  const deviceId = '55dfb53f-bed2-36da-8e85-cee7f02aa68e';
  const dest = {
    type: CallType.URI,
    address: 'tel:5003',
  };

  const dummyMidCallEvent = {
    eventType: 'callInfo',
    eventData: {
      callerId: {
        from: '"Bob Marley" <sip:5010@207.182.171.130;user=phone>;tag=888068389-1654853820619-',
      },
    },
  };

  let callManager: ICallManager;

  const deleteCallFromCollection = jest.fn();

  const disconnectStats = {
    'rtp-rxstat': {
      Dur: 53.77999999999787,
      LostPkt: 11,
      LatePkt: 0,
      Oct: 41156,
      Pkt: 2379,
      AvgJit: 0.041720656289440466,
      VQMetrics: {
        maxJitter: 0,
        VoPktSizeMs: 20,
        VoOneWayDelayMs: 0.26116666666666666,
        hwType: 'OS X 10.15.7 64-bit/Chrome-105.0.0.0',
        networkType: 'wifi',
        VoRxCodec: 'opus',
      },
    },
    'rtp-txstat': {
      Dur: 53.77999999999787,
      Pkt: 2410,
      Oct: 41156,
      VQMetrics: {
        VoTxCodec: 'opus',
        rtpBitRate: 32000,
      },
    },
  } as unknown as CallRtpStats;

  const parseMediaQualityStatisticsMock = jest
    .spyOn(Utils, 'parseMediaQualityStatistics')
    .mockReturnValue(disconnectStats);

  const mockTrack = {
    enabled: false,
  } as MediaStreamTrack;

  const mockEffect = {
    isEnabled: true,
    effectTrack: mockTrack,
    on: jest.fn(),
    off: jest.fn(),
  };

  const roapMediaConnectionConfig = {
    skipInactiveTransceivers: true,
    iceServers: [],
    iceCandidatesTimeout: ICE_CANDIDATES_TIMEOUT,
    sdpMunging: {
      convertPort9to0: true,
      addContentSlides: false,
      copyClineToSessionLevel: true,
    },
  };

  const roapMediaConnectionOptions = {
    localTracks: {audio: mockTrack},
    direction: {
      audio: 'sendrecv',
      video: 'inactive',
      screenShareVideo: 'inactive',
    },
  };

  afterEach(() => {
    webex.request = jest.fn();
  });

  beforeEach(() => {
    callManager = getCallManager(webex, defaultServiceIndicator);
  });

  it('create call object', () => {
    webex.request.mockReturnValueOnce({
      statusCode: 200,
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
          correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
        },
        callId: '8a67806f-fc4d-446b-a131-31e71ea5b020',
        callData: {
          callState: MobiusCallState.PROCEEDING,
        },
      },
    });
    const call = createCall(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator
    );

    expect(call).toBeTruthy();
  });

  it('should log a warning when sending a digit fails', async () => {
    const tone = '1';
    const errorMessage = 'Failed to send digit';

    // Mock the mediaConnection object
    const mockMediaConnection = {
      insertDTMF: jest.fn(() => {
        throw new Error(errorMessage);
      }),
    };

    const callManager = getCallManager(webex, defaultServiceIndicator);

    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    const realMediaConnection = call.mediaConnection;
    // Set the mock mediaConnection object
    call.mediaConnection = mockMediaConnection;

    // Spy on the log.warn method
    const logWarnSpy = jest.spyOn(log, 'warn');

    // Call the sendDigit method
    call.sendDigit(tone);

    // Expect the log.warn method to be called with the error message
    expect(logWarnSpy).toHaveBeenLastCalledWith(`Unable to send digit on call: ${errorMessage}`, {
      file: 'call',
      method: 'sendDigit',
    });

    // Restore the real mediaConnection object
    call.mediaConnection = realMediaConnection;

    call.end();
    await waitForMsecs(50); // Need to add a small delay for Promise and callback to finish.

    /* After call ends, call manager should have 0 record */
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(0);
  });

  it('delete call object when ending the call', async () => {
    webex.request.mockReturnValue({
      statusCode: 200,
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
          correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
        },
        callId: '8a67806f-fc4d-446b-a131-31e71ea5b020',
      },
    });

    const callManager = getCallManager(webex, defaultServiceIndicator);

    const mockStream = {
      on: jest.fn(),
      setUserMuted: jest.fn(),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    expect(call).toBeTruthy();
    /* After creation , call manager should have 1 record */
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(1);
    call.mute(localAudioStream);
    expect(call.isMuted()).toEqual(true);
    expect(mockStream.setUserMuted).toBeCalledOnceWith(true);
    call.mute(localAudioStream);
    expect(mockStream.setUserMuted).toBeCalledWith(false);
    expect(call.isMuted()).toEqual(false);
    call.end();
    await waitForMsecs(50); // Need to add a small delay for Promise and callback to finish.
    expect(parseMediaQualityStatisticsMock).toHaveBeenCalledTimes(1);
    expect(webex.request.mock.calls[0][0].body.metrics).toStrictEqual(disconnectStats);
    expect(call.getDisconnectReason().code).toBe(DisconnectCode.NORMAL);
    expect(call.getDisconnectReason().cause).toBe(DisconnectCause.NORMAL);

    /* After call ends, call manager should have 0 record */
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(0);
  });

  it('Check whether media requests succeed or not', async () => {
    webex.request.mockReturnValue({
      statusCode: 200,
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
          correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
        },
        callId: '8a67806f-fc4d-446b-a131-31e71ea5b020',
      },
    });

    const mediaResponse = {
      statusCode: 200,
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
          correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
        },
        callId: '8a67806f-fc4d-446b-a131-31e71ea5b020',
      },
    };

    const call = callManager.createCall(dest, CallDirection.INBOUND, deviceId, mockLineId);

    const response = await call['postMedia']({});

    expect(response.body).toStrictEqual(mediaResponse.body);
  });

  it('check whether callerId midcall event is serviced or not', async () => {
    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    call.handleMidCallEvent(dummyMidCallEvent);
    await waitForMsecs(50);
    expect(call.getCallerInfo().name).toStrictEqual('Bob Marley');
    expect(call.getCallerInfo().num).toStrictEqual('5010');
    expect(call.getCallerInfo().avatarSrc).toBeFalsy();
  });

  it('check whether call midcall event is serviced or not', async () => {
    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    dummyMidCallEvent.eventType = 'callState';

    const logSpy = jest.spyOn(log, 'log');

    call.handleMidCallEvent(dummyMidCallEvent);
    await waitForMsecs(50);
    const corelationId = call.getCorrelationId();

    expect(logSpy).toHaveBeenLastCalledWith(
      `Received Midcall call event for correlationId : ${corelationId}`,
      {file: 'call', method: 'handleMidCallEvent'}
    );
  });

  it('check call stats for active call', async () => {
    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    let callRtpStats;

    try {
      callRtpStats = await call.getCallRtpStats();
    } catch (e) {
      console.error(e);
    }

    expect(callRtpStats).toStrictEqual(disconnectStats);
  });

  it('dial functionality tests for coverage', async () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
      },
      on: jest.fn(),
      getEffectByKind: jest.fn().mockImplementation(() => {
        return mockEffect;
      }),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    const warnSpy = jest.spyOn(log, 'warn');
    const call = createCall(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator
    );

    const bnrMetricSpy = jest.spyOn(call['metricManager'], 'submitBNRMetric');

    call.dial(localAudioStream);

    expect(mockTrack.enabled).toEqual(true);
    expect(mockInternalMediaCoreModule.RoapMediaConnection).toBeCalledOnceWith(
      roapMediaConnectionConfig,
      roapMediaConnectionOptions,
      expect.any(String)
    );
    expect(call['mediaStateMachine'].state.value).toBe('S_SEND_ROAP_OFFER');

    expect(bnrMetricSpy).toBeCalledOnceWith(
      METRIC_EVENT.BNR_ENABLED,
      METRIC_TYPE.BEHAVIORAL,
      call.getCallId(),
      call.getCorrelationId()
    );

    /* Now change the state and recall to check for error */
    call['mediaStateMachine'].state.value = 'S_SEND_ROAP_OFFER';
    call.dial(localAudioStream);
    expect(call['mediaStateMachine'].state.value).toBe('S_SEND_ROAP_OFFER');
    expect(warnSpy).toBeCalledOnceWith(
      `Call cannot be dialed because the state is already : S_SEND_ROAP_OFFER`,
      {file: 'call', method: 'dial'}
    );
  });

  it('answer functionality tests for coverage', async () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
      },
      on: jest.fn(),
      getEffectByKind: jest.fn().mockImplementation(() => {
        return mockEffect;
      }),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    const warnSpy = jest.spyOn(log, 'warn');
    const call = createCall(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator
    );
    /** Cannot answer in idle state */

    const bnrMetricSpy = jest.spyOn(call['metricManager'], 'submitBNRMetric');

    call.answer(localAudioStream);
    expect(mockTrack.enabled).toEqual(true);
    expect(mockInternalMediaCoreModule.RoapMediaConnection).toBeCalledOnceWith(
      roapMediaConnectionConfig,
      roapMediaConnectionOptions,
      expect.any(String)
    );
    expect(call['callStateMachine'].state.value).toBe('S_IDLE');
    expect(warnSpy).toBeCalledOnceWith(`Call cannot be answered because the state is : S_IDLE`, {
      file: 'call',
      method: 'answer',
    });

    /* Now change the state and recall to check for correct flow */
    call['callStateMachine'].state.value = 'S_SEND_CALL_PROGRESS';
    call.answer(localAudioStream);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_CONNECT');

    expect(bnrMetricSpy).toBeCalledOnceWith(
      METRIC_EVENT.BNR_ENABLED,
      METRIC_TYPE.BEHAVIORAL,
      call.getCallId(),
      call.getCorrelationId()
    );
  });

  it('testing enabling/disabling the BNR on an active call', async () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
      },
      on: jest.fn(),
      off: jest.fn(),
      getEffectByKind: jest.fn(),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;
    const onStreamSpy = jest.spyOn(localAudioStream, 'on');
    const onEffectSpy = jest.spyOn(mockEffect, 'on');
    const offStreamSpy = jest.spyOn(localAudioStream, 'off');
    const offEffectSpy = jest.spyOn(mockEffect, 'off');

    const call = createCall(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator
    );

    call.dial(localAudioStream);

    expect(mockTrack.enabled).toEqual(true);
    expect(mockInternalMediaCoreModule.RoapMediaConnection).toBeCalledOnceWith(
      roapMediaConnectionConfig,
      roapMediaConnectionOptions,
      expect.any(String)
    );
    expect(call['mediaStateMachine'].state.value).toBe('S_SEND_ROAP_OFFER');

    const updateLocalTracksSpy = jest.spyOn(call['mediaConnection'], 'updateLocalTracks');
    const bnrMetricSpy = jest.spyOn(call['metricManager'], 'submitBNRMetric');

    /* Update the stream with the effect */
    jest.spyOn(localAudioStream, 'getEffectByKind').mockReturnValue(mockEffect as any);

    /* Checking if listeners on the localAudioStream have been registered */
    expect(onStreamSpy).toBeCalledTimes(2);
    expect(onStreamSpy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.OutputTrackChange,
      expect.any(Function)
    );
    expect(onStreamSpy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.EffectAdded,
      expect.any(Function)
    );

    bnrMetricSpy.mockClear();
    /* Invoking the callback function to trigger EffectAdded event to simulate adding effect to the stream */
    onStreamSpy.mock.calls[1][1](mockEffect as any);

    expect(onEffectSpy).toBeCalledWith(EffectEvent.Enabled, expect.any(Function));
    expect(onEffectSpy).toBeCalledWith(EffectEvent.Disabled, expect.any(Function));

    /* Send Enabled event on the effect, update track and send metrics for BNR disabled */
    onStreamSpy.mock.calls[0][1](mockTrack as any);
    onEffectSpy.mock.calls[0][1]();

    expect(updateLocalTracksSpy).toBeCalledOnceWith({audio: mockTrack});
    expect(bnrMetricSpy).toBeCalledOnceWith(
      METRIC_EVENT.BNR_ENABLED,
      METRIC_TYPE.BEHAVIORAL,
      call.getCallId(),
      call.getCorrelationId()
    );

    /* Clear the mocks */
    updateLocalTracksSpy.mockClear();
    bnrMetricSpy.mockClear();

    /* Send Disabled event on the effect, update track and send metrics for BNR disabled */
    mockEffect.isEnabled = false;
    onStreamSpy.mock.calls[0][1](mockTrack as any);
    onEffectSpy.mock.calls[1][1]();

    expect(updateLocalTracksSpy).toBeCalledOnceWith({audio: mockTrack});
    expect(bnrMetricSpy).toBeCalledOnceWith(
      METRIC_EVENT.BNR_DISABLED,
      METRIC_TYPE.BEHAVIORAL,
      call.getCallId(),
      call.getCorrelationId()
    );

    call.end();
    await waitForMsecs(50);

    /* Checks for switching off the listeners on call disconnect */
    expect(offStreamSpy).toBeCalledTimes(2);
    expect(offStreamSpy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.OutputTrackChange,
      expect.any(Function)
    );
    expect(offStreamSpy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.EffectAdded,
      expect.any(Function)
    );
    expect(offEffectSpy).toBeCalledWith(EffectEvent.Enabled, expect.any(Function));
    expect(offEffectSpy).toBeCalledWith(EffectEvent.Disabled, expect.any(Function));
  });

  it('answer fails if localAudioTrack is empty', async () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([]),
      },
      on: jest.fn(),
      off: jest.fn(),
      getEffectByKind: jest.fn(),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;
    webex.request.mockReturnValue({
      statusCode: 200,
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
          correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
        },
        callId: '8a67806f-fc4d-446b-a131-31e71ea5b020',
      },
    });

    const warnSpy = jest.spyOn(log, 'warn');
    const call = createCall(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator
    );

    call.answer(localAudioStream);

    await waitForMsecs(50);
    expect(warnSpy).toBeCalledTimes(2);
    expect(warnSpy).toBeCalledWith(
      `Did not find a local track while answering the call ${call.getCorrelationId()}`,
      {file: 'call', method: 'answer'}
    );
    expect(call['callStateMachine'].state.value).toBe('S_CALL_CLEARED');
    expect(call['mediaStateMachine'].state.value).toBe('S_ROAP_IDLE');

    expect(call.getDisconnectReason().code).toBe(DisconnectCode.MEDIA_INACTIVITY);
    expect(call.getDisconnectReason().cause).toBe(DisconnectCause.MEDIA_INACTIVITY);

    expect(webex.request.mock.calls[0][0].body.metrics).toStrictEqual(disconnectStats);
  });

  it('dial fails if localAudioTrack is empty', async () => {
    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([]),
      },
      on: jest.fn(),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    const warnSpy = jest.spyOn(log, 'warn');
    const call = createCall(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator
    );

    call.dial(localAudioStream);

    await waitForMsecs(50);
    expect(warnSpy).toBeCalledTimes(1);
    expect(warnSpy).toBeCalledWith(
      `Did not find a local track while dialing the call ${call.getCorrelationId()}`,
      {file: 'call', method: 'dial'}
    );
    expect(call['callStateMachine'].state.value).toBe('S_IDLE');
    expect(call['mediaStateMachine'].state.value).toBe('S_ROAP_IDLE');

    expect(webex.request).not.toBeCalledOnceWith();
  });

  it('update media after call creation with valid stream', () => {
    const callManager = getCallManager(webex, defaultServiceIndicator);

    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
      },
      on: jest.fn(),
      off: jest.fn(),
      getEffectByKind: jest.fn(),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    const onStream1Spy = jest.spyOn(localAudioStream, 'on');
    const offStream1Spy = jest.spyOn(localAudioStream, 'off');

    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    call.dial(localAudioStream);

    expect(mockTrack.enabled).toEqual(true);
    expect(onStream1Spy).toBeCalledTimes(2);
    expect(onStream1Spy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.OutputTrackChange,
      expect.any(Function)
    );
    expect(onStream1Spy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.EffectAdded,
      expect.any(Function)
    );

    const mockTrack2 = {
      enabled: true,
    };

    const mockStream2 = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([mockTrack2]),
      },
      on: jest.fn(),
      getEffectByKind: jest.fn(),
    };

    const localAudioStream2 =
      mockStream2 as unknown as InternalMediaCoreModule.LocalMicrophoneStream;
    const onStream2Spy = jest.spyOn(localAudioStream2, 'on');

    call.updateMedia(localAudioStream2);

    expect(call['mediaConnection'].updateLocalTracks).toBeCalledOnceWith({audio: mockTrack2});
    expect(call['localAudioStream']).toEqual(localAudioStream2);
    expect(offStream1Spy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.EffectAdded,
      expect.any(Function)
    );
    expect(onStream2Spy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.OutputTrackChange,
      expect.any(Function)
    );
    expect(onStream2Spy).toBeCalledWith(
      InternalMediaCoreModule.LocalStreamEventNames.EffectAdded,
      expect.any(Function)
    );
  });

  it('update media with invalid stream', () => {
    const callManager = getCallManager(webex, defaultServiceIndicator);
    const warnSpy = jest.spyOn(log, 'warn');

    const mockStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
      },
      on: jest.fn(),
      getEffectByKind: jest.fn(),
    };

    const localAudioStream = mockStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    const call = callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    call.dial(localAudioStream);

    expect(mockTrack.enabled).toEqual(true);

    const errorStream = {
      outputStream: {
        getAudioTracks: jest.fn().mockReturnValue([]),
      },
    };

    const localAudioStream2 =
      errorStream as unknown as InternalMediaCoreModule.LocalMicrophoneStream;

    call.updateMedia(localAudioStream2);

    expect(call['mediaConnection'].updateLocalTracks).not.toBeCalled();
    expect(warnSpy).toBeCalledOnceWith(
      `Did not find a local track while updating media for call ${call.getCorrelationId()}. Will not update media`,
      {file: 'call', method: 'updateMedia'}
    );
  });
});

describe('State Machine handler tests', () => {
  const deviceId = '55dfb53f-bed2-36da-8e85-cee7f02aa68e';
  const dest = {
    type: CallType.URI,
    address: 'tel:5003',
  };

  const mockStatusBody = {
    device: {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      correlationId: 'b5476d4c-f48b-475e-b4e2-994e24d14ca2',
    },
    callId: 'fcf86aa5-5539-4c9f-8b72-667786ae9b6c',
  };

  let call: Call;

  let dtmfMock: jest.SpyInstance;

  beforeEach(() => {
    call = new Call(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const dummy = 10;
      },
      defaultServiceIndicator
    );
    jest.clearAllTimers();
    jest.useFakeTimers();
    call['callStateMachine'].state.value = 'S_IDLE';
    call.mediaConnection = mediaConnection;
    dtmfMock = jest.spyOn(call['mediaConnection'], 'insertDTMF');
  });

  // afterEach(() => call.removeAllListeners());

  it('successful session refresh', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_CALL_ESTABLISHED',
    };

    call['callStateMachine'].state.value = 'S_SEND_CALL_CONNECT';

    webex.request.mockReturnValue(statusPayload);
    jest.spyOn(global, 'setInterval');

    const funcSpy = jest.spyOn(call, 'postStatus').mockResolvedValue(statusPayload);
    const logSpy = jest.spyOn(log, 'info');

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    jest.advanceTimersByTime(DEFAULT_SESSION_TIMER);

    /* This is to flush all the promises from the Promise queue so that
     * Jest.fakeTimers can advance time and also clear the promise Queue
     */
    await flushPromises(3);

    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(funcSpy).toBeCalledTimes(1);
    expect(logSpy).toBeCalledWith('Session refresh successful', {
      file: 'call',
      method: 'handleCallEstablished',
    });
  });

  it('session refresh failure', async () => {
    expect.assertions(4);
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
    });

    webex.request.mockReturnValue(statusPayload);
    jest.spyOn(global, 'clearInterval');

    call.on(CALL_EVENT_KEYS.CALL_ERROR, (errObj) => {
      expect(errObj.type).toStrictEqual(ERROR_TYPE.FORBIDDEN_ERROR);
      expect(errObj.message).toStrictEqual(
        'An unauthorized action has been received. This action has been blocked. Please contact the administrator if this persists.'
      );
    });

    const funcSpy = jest.spyOn(call, 'postStatus').mockRejectedValue(statusPayload);

    if (call['sessionTimer'] === undefined) {
      /* In cases where this test is run independently/alone, there is no sessionTimer initiated
      Thus we will check and initialize the timer when not present by calling handleCallEstablish() */
      call['handleCallEstablished']({} as CallEvent);
    }
    call['handleCallEstablished']({} as CallEvent);

    jest.advanceTimersByTime(DEFAULT_SESSION_TIMER);

    /* This is to flush all the promises from the Promise queue so that
     * Jest.fakeTimers can advance time and also clear the promise Queue
     */

    await Promise.resolve();
    await Promise.resolve();

    expect(clearInterval).toHaveBeenCalledTimes(1);
    expect(funcSpy).toBeCalledTimes(1);
  });

  it('state changes during successful incoming call', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_RECV_CALL_SETUP',
      data: {
        seq: 1,
        messageType: 'OFFER',
      },
    };
    const postMediaSpy = jest.spyOn(call as any, 'postMedia');
    const deleteSpy = jest.spyOn(call as any, 'delete');

    webex.request.mockReturnValue(statusPayload);
    call['direction'] = CallDirection.INBOUND;
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_PROGRESS');

    dummyEvent.type = 'E_SEND_CALL_CONNECT';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_CONNECT');

    /* we should expect to forward the roap offer message to mediaSdk for further processing */
    dummyEvent.type = 'E_RECV_ROAP_OFFER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    /* expect sending roap answer to mobius */
    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toBeCalledOnceWith(dummyEvent.data as RoapMessage);

    const dummyOkEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: true,
        message: {
          seq: 1,
          messageType: 'OFFER',
        },
      },
    };

    /* we receive roap Ok from mobius and expect mediaSdk to process it */
    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyOkEvent.data.message as RoapMessage
    );

    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');
    expect(call.isConnected()).toBe(true);

    call.sendDigit('1');
    expect(dtmfMock).toBeCalledOnceWith('1');

    call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});
    expect(deleteSpy).toBeCalledOnceWith();
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_DISCONNECT');
  });

  it('state changes during unsuccessful incoming call due to no offer', async () => {
    call['direction'] = CallDirection.INBOUND;
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_RECV_CALL_SETUP',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
      },
    };

    webex.request.mockReturnValue(statusPayload);

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_PROGRESS');
    await call['handleOutgoingCallConnect']({type: 'E_SEND_CALL_CONNECT'} as CallEvent);
    /* state should not change since there is no offer received. */
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_PROGRESS');
    expect(call.isConnected()).toBeFalsy();

    call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_DISCONNECT');
  });

  it('state changes during unsuccessful incoming call due error in call connect', async () => {
    const warnSpy = jest.spyOn(log, 'warn');
    const stateMachineSpy = jest.spyOn(call, 'sendCallStateMachineEvt');
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const roapMessage = {
      seq: 1,
      message: {} as RoapMessage,
      type: 'OFFER',
    };

    call['direction'] = CallDirection.INBOUND;
    webex.request.mockReturnValue(statusPayload);

    call.sendCallStateMachineEvt({type: 'E_RECV_CALL_SETUP'} as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_PROGRESS');

    call.sendMediaStateMachineEvt({type: 'E_RECV_ROAP_OFFER', data: roapMessage} as RoapEvent);
    webex.request.mockRejectedValueOnce({statusCode: 403}).mockResolvedValue(statusPayload);

    await call['handleOutgoingCallConnect']({type: 'E_SEND_CALL_CONNECT'} as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_UNKNOWN');
    expect(stateMachineSpy).toBeCalledTimes(3);
    expect(warnSpy).toBeCalledTimes(4);
  });

  it('state changes during successful outgoing call', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_SEND_CALL_SETUP',
      data: undefined as any,
    };

    const postMediaSpy = jest.spyOn(call as any, 'postMedia');

    webex.request.mockReturnValue(statusPayload);

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_SETUP');
    dummyEvent.type = 'E_RECV_CALL_PROGRESS';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_PROGRESS');

    dummyEvent.type = 'E_SEND_ROAP_OFFER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);

    /**
     * Since the event doesn't have any data above, we should request media sdk for an offer here.
     * The below event is expected to be called again my mediaSdk.
     */
    dummyEvent.data = {
      seq: 1,
      messageType: 'OFFER',
      sdp: 'sdp',
    };
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.initiateOffer).toHaveBeenCalledTimes(1);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_ANSWER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    const dummyOkEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: false,
        message: {
          seq: 1,
          messageType: 'OK',
        },
      },
    };

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOkEvent.data.message as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_OFFER_REQUEST';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyEvent.type = 'E_SEND_ROAP_OFFER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_ANSWER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOkEvent.data.message as RoapMessage);

    /* With the two roap offer/answer transactions that we simulated earlier
      we get a total 4 outgoing and 3 incoming roap messages.
    */
    expect(postMediaSpy).toBeCalledTimes(4);
    expect(mediaConnection.roapMessageReceived).toBeCalledTimes(3);

    dummyEvent.type = 'E_RECV_CALL_CONNECT';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');
    expect(call.isConnected()).toBe(true);

    call.sendCallStateMachineEvt({type: 'E_SEND_CALL_DISCONNECT'});
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_DISCONNECT');
  });

  it('outgoing call where we receive connect directly after setup. Media established before connect. test call and media state changes', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });

    const dummySetupEvent = {
      type: 'E_SEND_CALL_SETUP',
      data: undefined as any,
    };

    const dummyConnectEvent = {
      type: 'E_RECV_CALL_CONNECT',
      data: undefined as any,
    };

    const dummyOfferEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: undefined as any,
    };

    const dummyAnswerEvent = {
      type: 'E_RECV_ROAP_ANSWER',
      data: {
        seq: 1,
        messageType: 'ANSWER',
        sdp: 'sdp',
      },
    };

    const dummyOkEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: false,
        message: {
          seq: 1,
          messageType: 'OK',
        },
      },
    };

    const postMediaSpy = jest.spyOn(call as any, 'postMedia');

    webex.request.mockReturnValue(statusPayload);

    call.sendCallStateMachineEvt(dummySetupEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_SETUP');

    call.sendMediaStateMachineEvt(dummyOfferEvent as RoapEvent);

    /**
     * Since the event doesn't have any data above, we should request media sdk for an offer here.
     * The below event is expected to be called again my mediaSdk.
     */
    dummyOfferEvent.data = {
      seq: 1,
      messageType: 'OFFER',
      sdp: 'sdp',
    };
    call.sendMediaStateMachineEvt(dummyOfferEvent as RoapEvent);
    expect(mediaConnection.initiateOffer).toHaveBeenCalledTimes(1);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOfferEvent.data as RoapMessage);

    call.sendMediaStateMachineEvt(dummyAnswerEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyAnswerEvent.data as RoapMessage
    );

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOkEvent.data.message as RoapMessage);

    expect(call['mediaStateMachine'].state.value).toBe('S_ROAP_OK');

    call.sendCallStateMachineEvt(dummyConnectEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');
    expect(call.isConnected()).toBe(true);

    call.sendCallStateMachineEvt({type: 'E_SEND_CALL_DISCONNECT'});
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_DISCONNECT');
  });

  it('state changes during successful outgoing call with early media', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_SEND_CALL_SETUP',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
      },
    };

    webex.request.mockReturnValue(statusPayload);

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_SETUP');
    dummyEvent.type = 'E_RECV_CALL_PROGRESS';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_PROGRESS');

    /* Send a second callProgress event with inband media and it should handle */
    dummyEvent.data['callProgressData'] = {inbandMedia: true};
    dummyEvent.data['callerId'] = {
      from: '"Bob Marley" <sip:5010@207.182.171.130;user=phone>;tag=888068389-1654853820619-',
    };
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_PROGRESS');

    dummyEvent.type = 'E_RECV_CALL_CONNECT';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');

    call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_DISCONNECT');
  });

  it('state changes during unsuccessful outgoing call due to error in call setup', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_SEND_CALL_SETUP',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
      },
    };

    webex.request.mockRejectedValueOnce(statusPayload);

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    await flushPromises(3);
    expect(call['callStateMachine'].state.value).toBe('S_UNKNOWN');
  });

  it('state changes during unsuccessful outgoing call due to error in media ok', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: false,
        message: {} as RoapMessage,
      },
    };

    call['callStateMachine'].state.value = 'S_RECV_CALL_PROGRESS';
    call['earlyMedia'] = true;
    call['mediaStateMachine'].state.value = 'S_RECV_ROAP_ANSWER';
    webex.request.mockRejectedValue(statusPayload);

    await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);
    await flushPromises(2);
    expect(call.isConnected()).toBe(false);

    expect(call['mediaStateMachine'].state.value).toBe('S_ROAP_ERROR');
    expect(call['callStateMachine'].state.value).toBe('S_UNKNOWN');
  });

  it('state changes during unsuccessful outgoing call since no sdp in offer', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      body: mockStatusBody,
    });

    const dummyEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: {
        seq: 1,
        type: 'OFFER',
      },
    };

    webex.request.mockReturnValue(statusPayload);
    call['callStateMachine'].state.value = 'S_RECV_CALL_PROGRESS';
    call['mediaStateMachine'].state.value = 'S_ROAP_IDLE';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    /* since there is no sdp, mediaMachine should remain in same state
    and an initiateOffer request to be sent to SDK only once */
    expect(call['mediaStateMachine'].state.value).toBe('S_SEND_ROAP_OFFER');
    expect(mediaConnection.initiateOffer).toBeCalledOnceWith();
  });

  it('Outgoing Roap offer retry-after error case during midcall', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        'retry-after': 1,
      },
      body: mockStatusBody,
    });

    jest.spyOn(global, 'setTimeout');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockRejectedValueOnce(statusPayload);

    const stateMachineSpy = jest.spyOn(call, 'sendMediaStateMachineEvt');

    const dummyEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
        sdp: 'sdp',
      },
    };

    call['connected'] = true;

    await call['handleOutgoingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
    jest.advanceTimersByTime(1005);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(funcSpy).toHaveBeenCalledWith(dummyEvent.data);

    /* first failure , and second because of retry-after */
    expect(funcSpy).toHaveBeenCalledTimes(2);
    expect(stateMachineSpy).toBeCalledOnceWith(dummyEvent);
  });

  it('Outgoing Roap offer retry-after error case during call establishment', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        'retry-after': 1,
      },
      body: mockStatusBody,
    });

    jest.spyOn(global, 'setTimeout');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockRejectedValueOnce(statusPayload);

    const stateMachineSpy = jest.spyOn(call, 'sendMediaStateMachineEvt');

    const dummyEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
        sdp: 'sdp',
      },
    };

    call['connected'] = false;

    await call['handleOutgoingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
    jest.advanceTimersByTime(1005);
    expect(funcSpy).toBeCalledOnceWith(dummyEvent.data);

    /* These shouldn't be called as call is not connected yet */
    expect(setTimeout).not.toHaveBeenCalled();
    expect(stateMachineSpy).not.toBeCalled();
  });

  it('Outgoing Roap Answer retry-after error case during midcall', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        'retry-after': 1,
      },
      body: mockStatusBody,
    });

    jest.spyOn(global, 'setTimeout');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockRejectedValueOnce(statusPayload);

    const stateMachineSpy = jest.spyOn(call, 'sendMediaStateMachineEvt');

    const dummyEvent = {
      type: 'E_SEND_ROAP_ANSWER',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
      },
    };

    call['connected'] = true;
    call['mediaStateMachine'].state.value = 'S_RECV_ROAP_OFFER';
    await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);
    jest.advanceTimersByTime(1005);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(funcSpy).toHaveBeenCalledWith(dummyEvent.data);

    /* first failure , and second because of retry-after */
    expect(funcSpy).toHaveBeenCalledTimes(2);
    expect(stateMachineSpy).toBeCalledOnceWith(dummyEvent);
  });

  it('Outgoing Roap answer retry-after error case during call establishment', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        'retry-after': 1,
      },
      body: mockStatusBody,
    });

    jest.spyOn(global, 'setTimeout');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockRejectedValueOnce(statusPayload);

    const stateMachineSpy = jest.spyOn(call, 'sendMediaStateMachineEvt');

    const dummyEvent = {
      type: 'E_SEND_ROAP_ANSWER',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
      },
    };

    call['connected'] = false;

    await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);
    jest.advanceTimersByTime(1005);

    expect(funcSpy).toBeCalledOnceWith(dummyEvent.data);
    expect(funcSpy).toHaveBeenCalledTimes(1);

    /* These shouldn't be called as call is not connected yet */
    expect(setTimeout).not.toHaveBeenCalled();
    expect(stateMachineSpy).not.toBeCalled();
  });

  it('ROAP error during mid call', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });

    const warnSpy = jest.spyOn(log, 'warn');
    const stateMachineSpy = jest.spyOn(call as any, 'sendCallStateMachineEvt');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockResolvedValue(statusPayload);

    const errorEvent = {
      type: 'E_ROAP_ERROR',
      data: {
        seq: 2,
        messageType: 'ERROR',
        errorType: 'OUT_OF_ORDER',
      },
    };

    call['mediaStateMachine'].state.value = 'S_SEND_ROAP_ANSWER';
    call['connected'] = true;
    call.sendMediaStateMachineEvt(errorEvent as RoapEvent);
    expect(funcSpy).toBeCalledOnceWith(errorEvent.data);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(stateMachineSpy).not.toHaveBeenCalled();
  });

  it('ROAP ok retry-after during mid call', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        'retry-after': 1,
      },
      body: mockStatusBody,
    });

    jest.spyOn(global, 'setTimeout');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockRejectedValueOnce(statusPayload);

    const stateMachineSpy = jest.spyOn(call, 'sendMediaStateMachineEvt');

    const dummyEvent = {
      type: 'E_ROAP_OK',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OK',
      },
    };

    call['connected'] = true;
    call['mediaStateMachine'].state.value = 'S_RECV_ROAP_ANSWER';
    await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);
    jest.advanceTimersByTime(1005);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(funcSpy).toHaveBeenCalled();

    /* first failure , and second because of retry-after */
    expect(funcSpy).toHaveBeenCalledTimes(2);
    expect(stateMachineSpy).toBeCalledOnceWith(dummyEvent);
  });

  it('Unable to communicate roap error with mobius', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      body: mockStatusBody,
    });

    const stateMachineSpy = jest.spyOn(call as any, 'sendCallStateMachineEvt');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockRejectedValue(statusPayload);

    const errorEvent = {
      type: 'E_ROAP_ERROR',
      data: {
        seq: 2,
        messageType: 'ERROR',
        errorType: 'OUT_OF_ORDER',
      },
    };

    call['mediaStateMachine'].state.value = 'S_SEND_ROAP_ANSWER';
    call['connected'] = true;
    call.sendMediaStateMachineEvt(errorEvent as RoapEvent);
    expect(funcSpy).toBeCalledOnceWith(errorEvent.data);
    expect(stateMachineSpy).not.toHaveBeenCalled();
  });

  it('ROAP error during call establishment', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });

    const warnSpy = jest.spyOn(log, 'warn');
    const stateMachineSpy = jest.spyOn(call as any, 'sendCallStateMachineEvt');

    const funcSpy = jest.spyOn(call as any, 'postMedia').mockResolvedValue(statusPayload);

    const errorEvent = {
      type: 'E_ROAP_ERROR',
      data: {
        seq: 2,
        messageType: 'ERROR',
        errorType: 'OUT_OF_ORDER',
      },
    };

    call['connected'] = false;
    await call['handleRoapError']({} as MediaContext, errorEvent as RoapEvent);

    expect(funcSpy).toBeCalledOnceWith(errorEvent.data);
    expect(warnSpy).toBeCalledOnceWith('Call failed due to media issue', {
      file: 'call',
      method: 'handleRoapError',
    });
    expect(stateMachineSpy).toBeCalledOnceWith({data: {media: true}, type: 'E_UNKNOWN'});
  });

  it('state changes during successful incoming call with out of order events', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_RECV_CALL_SETUP',
      data: {
        seq: 1,
        messageType: 'OFFER',
      },
    };
    const postMediaSpy = jest.spyOn(call as any, 'postMedia');

    webex.request.mockReturnValue(statusPayload);
    call['direction'] = CallDirection.INBOUND;
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_PROGRESS');

    dummyEvent.type = 'E_SEND_CALL_CONNECT';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_CONNECT');

    /* we should expect to forward the roap offer message to mediaSdk for further processing */
    dummyEvent.type = 'E_RECV_ROAP_OFFER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    /* expect sending roap answer to mobius */
    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 1,
      messageType: 'ANSWER',
    };

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toBeCalledOnceWith(dummyEvent.data as RoapMessage);

    /* we receive roap Offer Request followed by roap Ok from mobius and handle
      out of order events by buffering and processing them in sequence */
    const dummyOkEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: true,
        message: {
          seq: 1,
          messageType: 'OK',
        },
      },
    };

    dummyEvent.type = 'E_RECV_ROAP_OFFER_REQUEST';
    dummyEvent.data = {
      seq: 2,
      messageType: 'OFFER_REQUEST',
    };

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(call['receivedRoapOKSeq']).toBe(0);
    expect(mediaConnection.roapMessageReceived).not.toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenNthCalledWith(
      2,
      dummyOkEvent.data.message as RoapMessage
    );

    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    const dummyOfferEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: {
        seq: 2,
        messageType: 'OFFER',
        sdp: 'sdp',
      },
    };

    expect(call['mediaStateMachine'].state.value).toBe('S_RECV_ROAP_OFFER_REQUEST');
    call.sendMediaStateMachineEvt(dummyOfferEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOfferEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 2,
      messageType: 'ANSWER',
    };

    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyOkEvent.data = {
      received: false,
      message: {
        seq: 2,
        messageType: 'OK',
      },
    };

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOkEvent.data.message as RoapMessage);

    /* With the two roap offer/answer transactions that we simulated earlier
      we get a total 4 outgoing and 3 incoming roap messages.
    */
    expect(postMediaSpy).toBeCalledTimes(3);
    expect(mediaConnection.roapMessageReceived).toBeCalledTimes(4);

    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');
    expect(call.isConnected()).toBe(true);

    dummyEvent.type = 'E_CALL_HOLD';
    dummyEvent.data = {
      seq: 3,
      messageType: 'OFFER',
    };
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    dummyEvent.type = 'E_RECV_ROAP_OFFER';

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 3,
      messageType: 'ANSWER',
    };

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_OFFER';
    dummyEvent.data = {
      seq: 4,
      messageType: 'OFFER',
    };

    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(call['receivedRoapOKSeq']).toBe(2);
    expect(mediaConnection.roapMessageReceived).not.toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyOkEvent.data = {
      received: true,
      message: {
        seq: 3,
        messageType: 'OK',
      },
    };

    await call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenNthCalledWith(
      6,
      dummyOkEvent.data.message as RoapMessage
    );

    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 4,
      messageType: 'ANSWER',
    };

    expect(call['mediaStateMachine'].state.value).toBe('S_RECV_ROAP_OFFER');
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);
  });

  it('successfully handles out of order events when ROAP OK is received while executing outgoingRoapAnswer', async () => {
    const mockStatusBody = {
      device: {
        deviceId: '123e4567-e89b-12d3-a456-426614174000',
        correlationId: 'b5476d4c-f48b-475e-b4e2-994e24d14ca2',
      },
      callId: 'fcf86aa5-5539-4c9f-8b72-667786ae9b6c',
    };

    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });
    const dummyEvent = {
      type: 'E_RECV_CALL_SETUP',
      data: {
        seq: 1,
        messageType: 'OFFER',
      },
    };
    const postMediaSpy = jest.spyOn(call as any, 'postMedia');

    webex.request.mockReturnValue(statusPayload);
    call['direction'] = CallDirection.INBOUND;
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_PROGRESS');

    dummyEvent.type = 'E_SEND_CALL_CONNECT';
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_CONNECT');

    /* we should expect to forward the roap offer message to mediaSdk for further processing */
    dummyEvent.type = 'E_RECV_ROAP_OFFER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    /* expect sending roap answer to mobius */
    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 1,
      messageType: 'ANSWER',
    };

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toBeCalledOnceWith(dummyEvent.data as RoapMessage);

    /* we receive roap Offer Request followed by roap Ok from mobius and handle
      out of order events by buffering and processing them in sequence */
    const dummyOkEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: true,
        message: {
          seq: 1,
          messageType: 'OK',
        },
      },
    };

    dummyEvent.type = 'E_RECV_ROAP_OFFER_REQUEST';
    dummyEvent.data = {
      seq: 2,
      messageType: 'OFFER_REQUEST',
    };

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(call['receivedRoapOKSeq']).toBe(0);
    expect(mediaConnection.roapMessageReceived).not.toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenNthCalledWith(
      2,
      dummyOkEvent.data.message as RoapMessage
    );

    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    const dummyOfferEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: {
        seq: 2,
        messageType: 'OFFER',
        sdp: 'sdp',
      },
    };

    expect(call['mediaStateMachine'].state.value).toBe('S_RECV_ROAP_OFFER_REQUEST');
    call.sendMediaStateMachineEvt(dummyOfferEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOfferEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 2,
      messageType: 'ANSWER',
    };

    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyOkEvent.data = {
      received: false,
      message: {
        seq: 2,
        messageType: 'OK',
      },
    };

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOkEvent.data.message as RoapMessage);

    /* With the two roap offer/answer transactions that we simulated earlier
      we get a total 4 outgoing and 3 incoming roap messages.
    */
    expect(postMediaSpy).toBeCalledTimes(3);
    expect(mediaConnection.roapMessageReceived).toBeCalledTimes(4);

    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');
    expect(call.isConnected()).toBe(true);

    dummyEvent.type = 'E_CALL_HOLD';
    dummyEvent.data = {
      seq: 3,
      messageType: 'OFFER',
    };
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    dummyEvent.type = 'E_RECV_ROAP_OFFER';

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 3,
      messageType: 'ANSWER',
    };

    await call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_ROAP_OFFER';
    dummyEvent.data = {
      seq: 4,
      messageType: 'OFFER',
    };

    dummyOkEvent.data = {
      received: true,
      message: {
        seq: 3,
        messageType: 'OK',
      },
    };

    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    await call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(call['receivedRoapOKSeq']).toBe(3);
    expect(mediaConnection.roapMessageReceived).toHaveBeenNthCalledWith(
      6,
      dummyOkEvent.data.message as RoapMessage
    );

    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );

    dummyEvent.type = 'E_SEND_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 4,
      messageType: 'ANSWER',
    };

    expect(call['mediaStateMachine'].state.value).toBe('S_RECV_ROAP_OFFER');
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);
  });

  it('handle hold event successfully when media received after progress but before connect', async () => {
    const statusPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockStatusBody,
    });

    const dummyEvent = {
      type: 'E_SEND_CALL_SETUP',
      data: {
        seq: 1,
        messageType: 'OFFER',
        sdp: 'sdp',
      },
    };

    const postMediaSpy = jest.spyOn(call as any, 'postMedia');
    const infoSpy = jest.spyOn(log, 'info');

    webex.request.mockReturnValue(statusPayload);

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_SEND_CALL_SETUP');

    dummyEvent.type = 'E_SEND_ROAP_OFFER';
    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyEvent.data as RoapMessage);

    dummyEvent.type = 'E_RECV_CALL_PROGRESS';
    dummyEvent.data = undefined as any;

    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_RECV_CALL_PROGRESS');

    dummyEvent.type = 'E_RECV_ROAP_ANSWER';
    dummyEvent.data = {
      seq: 1,
      messageType: 'ANSWER',
      sdp: 'sdp',
    };

    call.sendMediaStateMachineEvt(dummyEvent as RoapEvent);
    expect(mediaConnection.roapMessageReceived).toHaveBeenLastCalledWith(
      dummyEvent.data as RoapMessage
    );
    expect(call['mediaNegotiationCompleted']).toBe(false);

    const dummyOkEvent = {
      type: 'E_ROAP_OK',
      data: {
        received: false,
        message: {
          seq: 1,
          messageType: 'OK',
        },
      },
    };

    call.sendMediaStateMachineEvt(dummyOkEvent as RoapEvent);
    expect(call['mediaNegotiationCompleted']).toBe(true);
    expect(postMediaSpy).toHaveBeenLastCalledWith(dummyOkEvent.data.message as RoapMessage);

    dummyEvent.type = 'E_RECV_CALL_CONNECT';
    dummyEvent.data = undefined as any;
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);

    /* Call will move to connect state then immediately move to established state as
       media negotiation is already completed before connect was received
    */
    expect(call['callStateMachine'].state.value).toBe('S_CALL_ESTABLISHED');
    expect(call.isConnected()).toBe(true);

    dummyEvent.type = 'E_CALL_HOLD';
    dummyEvent.data = undefined as any;
    call.sendCallStateMachineEvt(dummyEvent as CallEvent);
    expect(call['callStateMachine'].state.value).toBe('S_CALL_HOLD');

    expect(infoSpy).toHaveBeenLastCalledWith(`handleCallHold: ${call.getCorrelationId()}  `, {
      file: 'call',
      method: 'handleCallHold',
    });
  });
});

describe('Supplementary Services tests', () => {
  const deviceId = '55dfb53f-bed2-36da-8e85-cee7f02aa68e';
  const dest = {
    type: CallType.URI,
    address: 'tel:5003',
  };

  const mockResponseBody = {
    device: {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      correlationId: 'b5476d4c-f48b-475e-b4e2-994e24d14ca2',
    },
    callId: 'fcf86aa5-5539-4c9f-8b72-667786ae9b6c',
  };

  let call: Call;

  beforeEach(() => {
    /* Since we are not actually testing from the start of a call , so it's good to set the below
     * parameters manually
     */

    call = new Call(
      activeUrl,
      webex,
      dest,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const dummy = 10;
      },
      defaultServiceIndicator
    );
    call['connected'] = true;
    call['earlyMedia'] = false;

    /* Also supplementary services will start always from Call_Established state */
    call['callStateMachine'].state.value = 'S_CALL_ESTABLISHED';
    call.removeAllListeners(CALL_EVENT_KEYS.CALL_ERROR);

    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  describe('Call hold-resume tests', () => {
    const mockHeldEvent = {
      eventType: 'callState',
      eventData: {
        callState: 'HELD',
      },
    };

    const mockResumeEvent = {
      eventType: 'callState',
      eventData: {
        callState: 'CONNECTED',
      },
    };

    const dummyEvent = {
      type: 'E_SEND_ROAP_OFFER',
      data: {
        seq: 1,
        message: {} as RoapMessage,
        type: 'OFFER',
      },
    };

    beforeEach(() => {
      call.removeAllListeners();
    });

    it('Handle successful Call hold case without delayed http response', async () => {
      expect.assertions(7);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');
      const warnSpy = jest.spyOn(log, 'warn');

      call['held'] = false;

      call.on(CALL_EVENT_KEYS.HELD, async (correlationId) => {
        expect(correlationId).toStrictEqual(call.getCorrelationId());
      });

      await call.doHoldResume();
      await flushPromises(2);

      expect(setTimeout).toHaveBeenCalledTimes(1);
      call.handleMidCallEvent(mockHeldEvent as unknown as MidCallEvent);

      /* At this point, the Call State should be S_CALL_HOLD
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_HOLD');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      expect(clearTimeout).toHaveBeenCalledTimes(1);
      /* isHeld flag should be set and an Hold event should be emitted */
      expect(call.isHeld()).toStrictEqual(true);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      jest.advanceTimersByTime(12000);
      expect(warnSpy).not.toHaveBeenCalledWith('Hold response timed out', {
        file: 'call',
        method: 'handleCallHold',
      });
    });

    it('Handle successful Call hold case with delayed http response', async () => {
      expect.assertions(8);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');
      const warnSpy = jest.spyOn(log, 'warn');

      call['held'] = false;

      call.on(CALL_EVENT_KEYS.HELD, async (correlationId) => {
        expect(correlationId).toStrictEqual(call.getCorrelationId());
      });

      call.doHoldResume();
      await Promise.resolve();
      await Promise.resolve();

      expect(setTimeout).not.toHaveBeenCalled();
      call.handleMidCallEvent(mockHeldEvent as unknown as MidCallEvent);

      /* At this point, the Call State should be S_CALL_HOLD
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_HOLD');
      expect(call.isHeld()).toBe(true);
      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      expect(clearTimeout).not.toHaveBeenCalled();
      /* isHeld flag should be set and an Hold event should be emitted */
      expect(call.isHeld()).toStrictEqual(true);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      jest.advanceTimersByTime(12000);
      expect(warnSpy).not.toHaveBeenCalledWith('Hold response timed out', {
        file: 'call',
        method: 'handleCallHold',
      });
    });

    it('Handle failure Call Hold case during signalling', async () => {
      expect.assertions(4);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 503,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockRejectedValue(responsePayload);

      call['held'] = false;

      call.on(CALL_EVENT_KEYS.HOLD_ERROR, async (errObj) => {
        expect(errObj.type).toStrictEqual(ERROR_TYPE.SERVICE_UNAVAILABLE);
        expect(errObj.message).toStrictEqual(
          'An unknown error occurred. Wait a moment and try again.'
        );
      });

      await call.doHoldResume();
      await flushPromises(2);

      expect(call.isHeld()).toStrictEqual(false);

      /* At this point , the Call State should transition to S_CALL_ESTABLISHED
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
    });

    it('Handle failure Call Hold case during offer/answer exchange', async () => {
      expect.assertions(5);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      const rejectPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockResponseBody,
      });

      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(responsePayload)
        .mockRejectedValueOnce(rejectPayload);

      call['held'] = false;

      call.on(CALL_EVENT_KEYS.HOLD_ERROR, async (errObj) => {
        expect(errObj.type).toStrictEqual(ERROR_TYPE.SERVICE_UNAVAILABLE);
        expect(errObj.message).toStrictEqual(
          'An unknown error occurred. Wait a moment and try again.'
        );
      });

      call.doHoldResume();
      await flushPromises(2);

      /* the Call State should transition to S_CALL_ESTABLISHED
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_HOLD');

      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      /* We are intentionally failing the ROAP ANSWER */
      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      expect(call.isHeld()).toStrictEqual(false);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
    });

    it('Handle failure Call Hold case during roap ok out', async () => {
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');
      const warnSpy = jest.spyOn(log, 'warn');

      call['held'] = false;

      await call.doHoldResume();
      await flushPromises(2);

      expect(setTimeout).toHaveBeenCalledTimes(1);

      /* At this point, the Call State should be S_CALL_HOLD
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_HOLD');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      jest.spyOn(webex, 'request').mockRejectedValue({statusCode: 403});
      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      /* this is for coverage */
      call['callStateMachine'].state.value = 'S_CALL_HOLD';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      expect(call.isHeld()).toStrictEqual(false);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      expect(warnSpy).toHaveBeenCalledWith('Failed to process MediaOk request', {
        file: 'call',
        method: 'handleRoapEstablished',
      });
    });

    it('Handle failure Call resume case during roap ok out', async () => {
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');
      const warnSpy = jest.spyOn(log, 'warn');

      call['held'] = true;

      await call.doHoldResume();
      await flushPromises(2);

      expect(setTimeout).toHaveBeenCalledTimes(1);

      /* At this point, the Call State should be S_CALL_RESUME
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_RESUME');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      jest.spyOn(webex, 'request').mockRejectedValue({statusCode: 403});
      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      expect(call.isHeld()).toStrictEqual(true);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(warnSpy).toHaveBeenCalledWith('Failed to process MediaOk request', {
        file: 'call',
        method: 'handleRoapEstablished',
      });
    });

    it('Handle Call hold case where successful Held response does not come', async () => {
      expect.assertions(5);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);

      call['held'] = false;

      call.on(CALL_EVENT_KEYS.HOLD_ERROR, async (errObj) => {
        expect(errObj.type).toStrictEqual(ERROR_TYPE.TIMEOUT);
        expect(errObj.message).toStrictEqual(
          'An error occurred while placing the call on hold. Wait a moment and try again.'
        );
      });

      jest.runAllTimers();

      call.doHoldResume();
      await flushPromises(2);

      /* At this point, the Call State should be S_CALL_HOLD
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_HOLD');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      /* Advancing timer by 12 seconds so that it gets timed out */
      jest.advanceTimersByTime(12000);

      /* isHeld flag should be unset */
      expect(call.isHeld()).toStrictEqual(false);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
    });

    it('Handle successful Call Resume case without delayed http response', async () => {
      expect.assertions(7);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');
      const warnSpy = jest.spyOn(log, 'warn');

      call['held'] = true;

      call.on(CALL_EVENT_KEYS.RESUMED, async (correlationId) => {
        expect(correlationId).toStrictEqual(call.getCorrelationId());
      });

      await call.doHoldResume();
      await flushPromises(2);

      expect(setTimeout).toHaveBeenCalledTimes(1);
      call.handleMidCallEvent(mockResumeEvent as unknown as MidCallEvent);

      /* At this point ,the Call State should be S_CALL_RESUME
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_RESUME');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      expect(clearTimeout).toHaveBeenCalledTimes(1);
      /* isHeld flag should not be set and an Resume event should be emitted */
      expect(call.isHeld()).toStrictEqual(false);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      jest.advanceTimersByTime(12000);
      expect(warnSpy).not.toHaveBeenCalledWith('Resume response timed out', {
        file: 'call',
        method: 'handleCallResume',
      });
    });

    it('Handle successful Call Resume case with delayed http response', async () => {
      expect.assertions(7);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');
      const warnSpy = jest.spyOn(log, 'warn');

      call['held'] = true;

      call.on(CALL_EVENT_KEYS.RESUMED, async (correlationId) => {
        expect(correlationId).toStrictEqual(call.getCorrelationId());
      });

      call.doHoldResume();
      await Promise.resolve();
      await Promise.resolve();

      expect(setTimeout).not.toHaveBeenCalled();
      call.handleMidCallEvent(mockResumeEvent as unknown as MidCallEvent);

      /* At this point ,the Call State should be S_CALL_RESUME
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_RESUME');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      expect(clearTimeout).not.toHaveBeenCalled();
      /* isHeld flag should not be set and an Resume event should be emitted */
      expect(call.isHeld()).toStrictEqual(false);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      jest.advanceTimersByTime(12000);
      expect(warnSpy).not.toHaveBeenCalledWith('Resume response timed out', {
        file: 'call',
        method: 'handleCallResume',
      });
    });

    it('Handle failure Call Resume case during signalling', async () => {
      expect.assertions(4);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 503,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockRejectedValue(responsePayload);

      call['held'] = true;

      call.on(CALL_EVENT_KEYS.RESUME_ERROR, async (errObj) => {
        expect(errObj.type).toStrictEqual(ERROR_TYPE.SERVICE_UNAVAILABLE);
        expect(errObj.message).toStrictEqual(
          'An unknown error occurred. Wait a moment and try again.'
        );
      });

      await call.doHoldResume();
      await flushPromises(2);

      expect(call.isHeld()).toStrictEqual(true);

      /* At this point , the Call State should transition to S_CALL_ESTABLISHED
       */

      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
    });

    it('Handle failure Call Resume case during offer/answer exchange', async () => {
      expect.assertions(5);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      const rejectPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockResponseBody,
      });

      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(responsePayload)
        .mockRejectedValueOnce(rejectPayload);

      call['held'] = true;

      call.on(CALL_EVENT_KEYS.RESUME_ERROR, async (errObj) => {
        expect(errObj.type).toStrictEqual(ERROR_TYPE.SERVICE_UNAVAILABLE);
        expect(errObj.message).toStrictEqual(
          'An unknown error occurred. Wait a moment and try again.'
        );
      });

      call.doHoldResume();
      await flushPromises(2);

      /* At this point , the Call State should transition to S_CALL_ESTABLISHED
       */

      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_RESUME');

      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      /* We are intentionally failing the ROAP ANSWER */
      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      expect(call.isHeld()).toStrictEqual(true);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
    });

    it('Handle Call resume case where successful response does not come', async () => {
      expect.assertions(5);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);

      call['held'] = true;

      call.on(CALL_EVENT_KEYS.RESUME_ERROR, async (errObj) => {
        expect(errObj.type).toStrictEqual(ERROR_TYPE.TIMEOUT);
        expect(errObj.message).toStrictEqual(
          'An error occurred while resuming the call. Wait a moment and try again.'
        );
      });

      call.doHoldResume();
      await flushPromises(2);

      /* At this point ,the Call State should be S_CALL_RESUME
       */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_RESUME');

      /* We simulate the media Connection events manually here as we are not really testing with actual
       * media.
       */
      call['handleIncomingRoapOffer']({} as MediaContext, dummyEvent as RoapEvent);
      const roapEvent = JSON.parse(JSON.stringify(dummyEvent));

      roapEvent.data.type = 'ANSWER';
      await call['handleOutgoingRoapAnswer']({} as MediaContext, dummyEvent as RoapEvent);

      roapEvent.data.type = 'OK';
      await call['handleRoapEstablished']({} as MediaContext, dummyEvent as RoapEvent);

      /* Advancing timer by 12 seconds so that it gets timed out */
      jest.advanceTimersByTime(12000);

      expect(call.isHeld()).toStrictEqual(true);
      /* We should return back to call established state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
    });
  });

  describe('Call transfer tests', () => {
    const transfereeNumber = '5004';
    const transfereeDest = {
      type: CallType.URI,
      address: `tel:${transfereeNumber}`,
    };
    let secondCall: Call;

    /* A spy on handleCallErrors to check whether it is being invoked or not depending on tests */
    const handleErrorSpy = jest.spyOn(Utils, 'handleCallErrors');
    const transferLoggingContext = {
      file: 'call',
      method: 'completeTransfer',
    };

    beforeEach(() => {
      /* We will put the first call on hold to perform the transfer */
      call['held'] = true;

      /* We will create a second call just like the first call, but call is active, i.e, not held */
      secondCall = new Call(
        activeUrl,
        webex,
        transfereeDest,
        CallDirection.OUTBOUND,
        deviceId,
        mockLineId,
        () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const dummy = 10;
        },
        defaultServiceIndicator
      );
      secondCall['connected'] = true;
      secondCall['earlyMedia'] = false;
      secondCall['callStateMachine'].state.value = 'S_CALL_ESTABLISHED';
      secondCall.removeAllListeners(CALL_EVENT_KEYS.CALL_ERROR);
      secondCall['held'] = false;
    });

    it('Handle successful consult transfer case ', async () => {
      expect.assertions(9);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      const requestSpy = jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      const warnSpy = jest.spyOn(log, 'warn');
      const infoSpy = jest.spyOn(log, 'info');
      const metricSpy = jest.spyOn(call['metricManager'], 'submitCallMetric');

      call.on(CALL_EVENT_KEYS.DISCONNECT, async (correlationId) => {
        expect(correlationId).toStrictEqual(call.getCorrelationId());
      });
      secondCall.on(CALL_EVENT_KEYS.DISCONNECT, async (correlationId) => {
        expect(correlationId).toStrictEqual(secondCall.getCorrelationId());
      });

      await call.completeTransfer(TransferType.CONSULT, secondCall.getCallId(), undefined);
      await flushPromises(2);

      expect(requestSpy).toBeCalled();
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL,
        TRANSFER_ACTION.CONSULT,
        METRIC_TYPE.BEHAVIORAL,
        call.getCallId(),
        call.getCorrelationId(),
        undefined
      );

      call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});
      secondCall.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});

      /* We should return back to S_RECV_CALL_DISCONNECT state for both the calls */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_RECV_CALL_DISCONNECT');
      expect(secondCall['callStateMachine'].state.value).toStrictEqual('S_RECV_CALL_DISCONNECT');
      expect(handleErrorSpy).not.toBeCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        `Initiating Consult transfer between : ${call.getCallId()} and ${secondCall.getCallId()}`,
        transferLoggingContext
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        `Consult Transfer failed for correlationId ${call.getCorrelationId()}`,
        transferLoggingContext
      );
    });

    it('Handle successful blind transfer case ', async () => {
      expect.assertions(7);
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 200,
        body: mockResponseBody,
      });

      const requestSpy = jest.spyOn(webex, 'request').mockResolvedValue(responsePayload);
      const warnSpy = jest.spyOn(log, 'warn');
      const infoSpy = jest.spyOn(log, 'info');
      const metricSpy = jest.spyOn(call['metricManager'], 'submitCallMetric');

      call.on(CALL_EVENT_KEYS.DISCONNECT, async (correlationId) => {
        expect(correlationId).toStrictEqual(call.getCorrelationId());
      });

      await call.completeTransfer(TransferType.BLIND, undefined, transfereeNumber);
      await flushPromises(2);

      expect(requestSpy).toBeCalled();
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL,
        TRANSFER_ACTION.BLIND,
        METRIC_TYPE.BEHAVIORAL,
        call.getCallId(),
        call.getCorrelationId(),
        undefined
      );

      call.sendCallStateMachineEvt({type: 'E_RECV_CALL_DISCONNECT'});

      /* We should return back to S_RECV_CALL_DISCONNECT state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_RECV_CALL_DISCONNECT');
      expect(handleErrorSpy).not.toBeCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        `Initiating Blind transfer with : ${transfereeNumber}`,
        transferLoggingContext
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        `Blind Transfer failed for correlationId ${call.getCorrelationId()}`,
        transferLoggingContext
      );
    });

    it('Handle unsuccessful blind transfer case', async () => {
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 403,
        body: mockResponseBody,
      });
      const emitSpy = jest.spyOn(call, 'emit');
      const requestSpy = jest.spyOn(webex, 'request').mockRejectedValue(responsePayload);
      const warnSpy = jest.spyOn(log, 'warn');
      const metricSpy = jest.spyOn(call['metricManager'], 'submitCallMetric');

      await call.completeTransfer(TransferType.BLIND, undefined, transfereeNumber);
      await flushPromises(1);

      expect(requestSpy).toBeCalled();
      /* We should be in CALL_ESTABLISHED state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(call['held']).toBe(true);
      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        expect.anything(),
        call.getCorrelationId(),
        responsePayload,
        'completeTransfer',
        'call'
      );
      /* check whether error event is being emitted by sdk */
      expect(emitSpy).toBeCalledOnceWith(CALL_EVENT_KEYS.TRANSFER_ERROR, expect.any(CallError));
      expect(warnSpy).toHaveBeenCalledWith(
        `Blind Transfer failed for correlationId ${call.getCorrelationId()}`,
        transferLoggingContext
      );
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL_ERROR,
        TRANSFER_ACTION.BLIND,
        METRIC_TYPE.BEHAVIORAL,
        call.getCallId(),
        call.getCorrelationId(),
        expect.any(CallError)
      );
    });

    it('Handle unsuccessful consult transfer case', async () => {
      const responsePayload = <SSResponse>(<unknown>{
        statusCode: 403,
        body: mockResponseBody,
      });

      const emitSpy = jest.spyOn(call, 'emit');
      const requestSpy = jest.spyOn(webex, 'request').mockRejectedValue(responsePayload);
      const warnSpy = jest.spyOn(log, 'warn');
      const metricSpy = jest.spyOn(call['metricManager'], 'submitCallMetric');

      await call.completeTransfer(TransferType.CONSULT, secondCall.getCallId(), undefined);

      await flushPromises(2);

      expect(requestSpy).toBeCalled();
      /* We should be in CALL_ESTABLISHED state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(call['held']).toBe(true);
      expect(secondCall['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        ERROR_LAYER.CALL_CONTROL,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        expect.anything(),
        call.getCorrelationId(),
        responsePayload,
        'completeTransfer',
        'call'
      );
      /* check whether error event is being emitted by sdk */
      expect(emitSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.TRANSFER_ERROR, expect.any(CallError));
      expect(warnSpy).toHaveBeenCalledWith(
        `Consult Transfer failed for correlationId ${call.getCorrelationId()}`,
        transferLoggingContext
      );
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL_ERROR,
        TRANSFER_ACTION.CONSULT,
        METRIC_TYPE.BEHAVIORAL,
        call.getCallId(),
        call.getCorrelationId(),
        expect.any(CallError)
      );
    });

    it('Handle blind transfer with undefined transferTarget', async () => {
      const requestSpy = jest.spyOn(webex, 'request');
      const warnSpy = jest.spyOn(log, 'warn');

      await call.completeTransfer(TransferType.BLIND, undefined, undefined);

      /* We should be in CALL_ESTABLISHED state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(secondCall['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(handleErrorSpy).not.toBeCalled();
      expect(requestSpy).not.toBeCalled();
      expect(warnSpy).toBeCalledOnceWith(
        `Invalid information received, transfer failed for correlationId: ${call.getCorrelationId()}`,
        transferLoggingContext
      );
    });

    it('Handle consult transfer with undefined transferCallId', async () => {
      const requestSpy = jest.spyOn(webex, 'request');
      const warnSpy = jest.spyOn(log, 'warn');

      await call.completeTransfer(TransferType.CONSULT, undefined, undefined);

      /* We should be in CALL_ESTABLISHED state */
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(secondCall['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');
      expect(handleErrorSpy).not.toBeCalled();
      expect(requestSpy).not.toBeCalled();
      expect(warnSpy).toBeCalledOnceWith(
        `Invalid information received, transfer failed for correlationId: ${call.getCorrelationId()}`,
        transferLoggingContext
      );
    });
  });
});

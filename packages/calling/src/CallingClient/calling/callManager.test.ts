/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable dot-notation */
import {waitForMsecs} from '../../common/Utils';
import {CallDirection, CallType, ServiceIndicator} from '../../common/types';
import {getTestUtilsWebex} from '../../common/testUtil';
import {getCallManager} from './callManager';
import {ICall, ICallManager, MobiusCallState} from './types';
import {Call} from './call';
import log from '../../Logger';
import {ILine} from '../line/types';
import {LINE_EVENT_KEYS} from '../../Events/types';

const webex = getTestUtilsWebex();
const defaultServiceIndicator = ServiceIndicator.CALLING;

const mediaEvent = {
  id: '73e6a2b2-968c-44ea-a536-e7702722f8d8',
  data: {
    message: {
      messageType: 'OFFER',
      sdp: 'v=0\r\no=BroadWorks 175625 1653906127914 IN IP4 207.182.171.180\r\ns=-\r\nc=IN IP4 207.182.171.180\r\nt=0 0\r\na=ice-lite\r\nm=audio 19564 UDP/TLS/RTP/SAVPF 99 9 0 8 18 102 101\r\na=sendrecv\r\na=rtpmap:99 opus/48000/2\r\na=rtpmap:9 G722/8000\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\na=rtpmap:18 G729/8000\r\na=fmtp:18 annexb=no\r\na=rtpmap:102 iLBC/8000\r\na=fmtp:102 mode=30\r\na=rtpmap:101 telephone-event/8000\r\na=rtcp-mux\r\na=setup:actpass\r\na=ssrc:379289707 cname:HC3h2tromqGgnGaf\r\na=ice-ufrag:mLbW\r\na=ice-pwd:Hct9MYtML1sedttd8fLCg9aJ\r\na=fingerprint:sha-256 5E:F5:3D:98:57:03:D7:73:8F:C3:D4:FC:EC:FE:7F:4D:04:D8:EE:2A:29:C4:9F:35:C5:0F:D1:2D:CE:E4:AE:AA\r\na=candidate:mse 1 UDP 2130706431 207.182.171.180 19564 typ host\r\na=candidate:mse 2 UDP 2130706430 207.182.171.180 19565 typ host',
      seq: 1,
      version: '2',
    },
    callId: 'f2e89262-7d9a-489f-b65d-3b56a31c7bfe',
    callUrl:
      '[https://wdm-intb.ciscospark.com/wdm/api/v1/devices/14ef3832-a7af-4457-a660-fd1918d627d0]',
    deviceId: '375b8503-f716-3407-853b-cd9a8c4419a7',
    correlationId: '',
    eventType: 'mobius.media',
  },
  timestamp: 1653906128188,
  trackingId: 'ROUTER_62949AD0-DB6E-01BB-595A-03158964595A',
  alertType: 'full',
  headers: {},
  sequenceNumber: 7,
  filterMessage: false,
};

const setupEvent = {
  id: '3ee919c7-202d-4f8c-9b74-e5ee8a693dfa',
  data: {
    callerId: {
      'x-broadworks-remote-party-info':
        'userId="hkkcq0ekby@64941297.int10.bcld.webex.com";userDn="tel:+12142865895;ext=5008;country-code=1";externalId=652fe0c7-05ce-4acd-8bda-9a080830187f',
      from: '"Bob Marley" <sip:5008@207.182.171.130;user=phone>;tag=379221777-1653906128003-',
    },
    callId: 'f2e89262-7d9a-489f-b65d-3b56a31c7bfe',
    callUrl:
      '[https://wdm-intb.ciscospark.com/wdm/api/v1/devices/14ef3832-a7af-4457-a660-fd1918d627d0]',
    deviceId: '375b8503-f716-3407-853b-cd9a8c4419a7',
    correlationId: '',
    eventType: 'mobius.call',
    broadworksCorrelationInfo: 'Sample_broadworksCorrelationInfo',
  },
  timestamp: 1653906128159,
  trackingId: 'ROUTER_62949AD0-DB6E-01BB-595A-03158964595A',
  alertType: 'full',
  headers: {},
  sequenceNumber: 6,
  filterMessage: false,
};

const disconnectEvent = {
  id: 'f3e37504-5867-48ea-8d67-4e82b3ce1755',
  data: {
    causecode: 0,
    cause: 'Normal disconnect',
    callId: 'cbfe802c-cc8d-407f-863d-0abf8d6cc497',
    callUrl:
      '[https://wdm-intb.ciscospark.com/wdm/api/v1/devices/5691641c-7f0c-47a4-b248-e585ebcf653d]',
    deviceId: 'b9270663-54c8-3540-b01f-ed807dc5f9e8',
    correlationId: '',
    eventType: 'mobius.calldisconnected',
  },
  timestamp: 1653925625934,
  trackingId: 'NA_fe7efbbc-de52-438c-a6c3-58e96db230ba',
  alertType: 'full',
  headers: {},
  sequenceNumber: 6,
  filterMessage: false,
};
const deviceId = '55dfb53f-bed2-36da-8e85-cee7f02aa68e';
const dest = {
  type: CallType.URI,
  address: 'tel:5003',
};

const successResponseBody = {
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
};

const mockLineId = 'e4e8ee2a-a154-4e52-8f11-ef4cde2dce72';
const mockLine = {
  lineId: mockLineId,
} as ILine;

describe('Call Manager Tests with respect to calls', () => {
  const dummyResponse = {
    statusCode: 200,
    body: {
      device: {
        deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
        correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
      },
    },
  };

  const patchMock = jest.spyOn(Call.prototype as any, 'patch');
  const setDisconnectReasonMock = jest.spyOn(Call.prototype as any, 'setDisconnectReason');
  const deleteCallMock = jest.spyOn(Call.prototype as any, 'delete');
  const initMediaConnectionMock = jest.spyOn(Call.prototype as any, 'initMediaConnection');
  const mediaRoapEventsListenerMock = jest.spyOn(Call.prototype as any, 'mediaRoapEventsListener');
  const mediaTrackListenerMock = jest.spyOn(Call.prototype as any, 'mediaTrackListener');
  const postMediaMock = jest.spyOn(Call.prototype as any, 'postMedia');

  deleteCallMock.mockResolvedValue(dummyResponse); // Both are using dummy response
  setDisconnectReasonMock.mockReturnValue({});
  initMediaConnectionMock.mockReturnValue({});
  mediaRoapEventsListenerMock.mockReturnValue({});
  mediaTrackListenerMock.mockReturnValue({});
  postMediaMock.mockResolvedValue({});

  let callManager: ICallManager;

  beforeEach(() => {
    callManager = getCallManager(webex, defaultServiceIndicator);
    callManager.removeAllListeners(LINE_EVENT_KEYS.INCOMING_CALL);
    /* expect 0 calls at the beginning of each test as we are clearing calls at the end of every test case */
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(0);
  });

  afterEach(() => {
    /* lets clear all calls at the end of every test case */
    const calls = Object.values(callManager.getActiveCalls());

    calls.forEach((call) => {
      call.end();
    });
  });

  it('check instance of call manager', () => {
    expect(callManager).toBeTruthy();
  });

  it('Check whether callManager is singleton', () => {
    const callManagerNew = getCallManager(webex, defaultServiceIndicator);

    expect(callManager).toMatchObject(callManagerNew);
  });

  it('create a call using call manager', async () => {
    callManager.updateLine('8a67806f-fc4d-446b-a131-31e71ea5b010', mockLine);
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

    expect(callManager).toBeTruthy();
    const call = await callManager.createCall(CallDirection.OUTBOUND, deviceId, mockLineId, dest);

    call.setCallId('8a67806f-fc4d-446b-a131-31e71ea5b020');

    expect(call).toBeTruthy();
    expect(call.getCallId()).toStrictEqual('8a67806f-fc4d-446b-a131-31e71ea5b020');
    expect(call.lineId).toStrictEqual(mockLineId);
  });

  it('Accept an incoming call from Mobius where Call Setup was the first message', async () => {
    callManager.updateLine('375b8503-f716-3407-853b-cd9a8c4419a7', mockLine);
    callManager.on(LINE_EVENT_KEYS.INCOMING_CALL, (callObj: ICall) => {
      expect(callObj.getCallId()).toStrictEqual(setupEvent.data.callId);
      expect(callObj.getBroadworksCorrelationInfo()).toStrictEqual(
        setupEvent.data.broadworksCorrelationInfo
      );
      expect(callObj.lineId).toStrictEqual(mockLineId);
    });
    patchMock.mockResolvedValue(dummyResponse);

    await callManager['dequeueWsEvents'](setupEvent);
    await waitForMsecs(50);
    await callManager['dequeueWsEvents'](mediaEvent);
    await waitForMsecs(50);

    expect(patchMock).toHaveBeenCalledWith(MobiusCallState.ALERTING);
    /* setUp event should create the call and count will be 1 for new call */
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(1);
  });

  it('Accept an incoming call from Mobius where Media Event was the first message', async () => {
    callManager.updateLine('8a67806f-fc4d-446b-a131-31e71ea5b010', mockLine);
    patchMock.mockResolvedValue(dummyResponse);
    callManager.on(LINE_EVENT_KEYS.INCOMING_CALL, (callObj: ICall) => {
      expect(callObj.getCallId()).toStrictEqual(setupEvent.data.callId);
      expect(callObj['remoteRoapMessage'].sdp).toStrictEqual(mediaEvent.data.message.sdp);
    });

    await callManager['dequeueWsEvents'](mediaEvent);
    /* check whether SDP is buffered */
    await callManager['dequeueWsEvents'](setupEvent);
    expect(patchMock).toHaveBeenCalledWith(MobiusCallState.ALERTING);
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(1);
  });

  it('Disconnect a call if received a Call Disconnect event', async () => {
    webex.request.mockReturnValueOnce(successResponseBody);

    /* lets add a call to disconnect it later */
    const call = await callManager.createCall(dest, CallDirection.OUTBOUND, deviceId, mockLineId);

    expect(Object.keys(callManager.getActiveCalls()).length).toBe(1);
    /* clear the last added call */

    patchMock.mockResolvedValue(dummyResponse);
    disconnectEvent.data.correlationId = call.getCorrelationId();
    callManager['dequeueWsEvents'](disconnectEvent);

    /* Add a small delay , to simulate sending of Delete request and clearing from Call records */
    await waitForMsecs(50);

    expect(deleteCallMock).toHaveBeenCalled();
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(0);
  });

  it('Do not Disconnect a call if call has been disconnected already', async () => {
    webex.request.mockReturnValueOnce(successResponseBody);

    /* lets add a call to disconnect it later */
    await callManager.createCall(CallDirection.OUTBOUND, deviceId, mockLineId, dest);

    expect(Object.keys(callManager.getActiveCalls()).length).toBe(1);
    /* clear the last added call */

    patchMock.mockResolvedValue(dummyResponse);
    disconnectEvent.data.correlationId = '1234';
    callManager['dequeueWsEvents'](disconnectEvent);

    /* Add a small delay , to simulate sending of Delete request and clearing from Call records */
    await waitForMsecs(50);

    expect(deleteCallMock).not.toHaveBeenCalled();
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(1);
  });

  it('Accept an incoming call but Outgoing patch request fails', async () => {
    callManager.updateLine('8a67806f-fc4d-446b-a131-31e71ea5b010', mockLine);
    /* Intentionally failing the Patch with 503 */
    dummyResponse.statusCode = 503;
    patchMock.mockRejectedValue(dummyResponse);

    const warnSpy = jest.spyOn(log, 'warn');

    await callManager['dequeueWsEvents'](mediaEvent);
    await waitForMsecs(50);
    await callManager['dequeueWsEvents'](setupEvent);
    await waitForMsecs(50);

    expect(patchMock).toHaveBeenCalledWith(MobiusCallState.ALERTING);
    expect(warnSpy).toHaveBeenCalledWith('Failed to signal call progression', {
      file: 'call',
      method: 'handleOutgoingCallAlerting',
    });
    /* No calls should have been added as call progress failed */
    expect(Object.keys(callManager.getActiveCalls()).length).toBe(0);
  });

  it('Walk through an End to End call', async () => {
    callManager.updateLine('8a67806f-fc4d-446b-a131-31e71ea5b010', mockLine);
    let call: ICall;

    callManager.on(LINE_EVENT_KEYS.INCOMING_CALL, async (callObj: ICall) => {
      expect(callObj.getCallId()).toStrictEqual(setupEvent.data.callId);
      call = callObj;
      await waitForMsecs(50);

      const mediaSpy = jest.spyOn(call['mediaConnection'], 'roapMessageReceived');
      const mediaClose = jest.spyOn(call['mediaConnection'], 'close').mockReturnValue({});

      expect(Object.keys(callManager.getActiveCalls()).length).toBe(3);
      expect(call['callStateMachine'].state.value).toStrictEqual('S_SEND_CALL_PROGRESS');
      expect(patchMock).toHaveBeenCalledWith(MobiusCallState.ALERTING);

      /* Receive ROAP Offer */
      await callManager['dequeueWsEvents'](mediaEvent);
      await waitForMsecs(50);
      expect(call['mediaStateMachine'].state.value).toStrictEqual('S_RECV_ROAP_OFFER');

      const track = {} as MediaStreamTrack;

      /* User answers the call */
      await call.answer({localAudioTrack: track});
      await waitForMsecs(50);

      expect(call['callStateMachine'].state.value).toStrictEqual('S_SEND_CALL_CONNECT');
      expect(patchMock).toHaveBeenCalledWith(MobiusCallState.CONNECTED);
      expect(mediaSpy).toHaveBeenCalled(); /* We pass the offer to media connection */

      /* We are manually sending this event , ideally it will sent by MediaConnection. */
      call['sendMediaStateMachineEvt']({type: 'E_SEND_ROAP_ANSWER'});

      await waitForMsecs(50);
      expect(call['mediaStateMachine'].state.value).toStrictEqual('S_SEND_ROAP_ANSWER');

      /* Simulate ROAP_OK */
      mediaEvent.data.message.messageType = 'OK';
      await callManager['dequeueWsEvents'](mediaEvent);
      await waitForMsecs(50);

      expect(mediaSpy).toHaveBeenCalled();
      expect(call['mediaStateMachine'].state.value).toStrictEqual('S_ROAP_OK');
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      /* Simulate ROAP Offer_request */
      mediaEvent.data.message.messageType = 'OFFER_REQUEST';
      await callManager['dequeueWsEvents'](mediaEvent);
      await waitForMsecs(50);
      expect(mediaSpy).toHaveBeenCalled();

      /* We are manually sending this event , ideally it will sent by Media Connection. */
      call['sendMediaStateMachineEvt']({type: 'E_SEND_ROAP_OFFER'});

      expect(call['mediaStateMachine'].state.value).toStrictEqual('S_SEND_ROAP_OFFER');

      /* Simulate ROAP Answer */
      mediaEvent.data.message.messageType = 'ANSWER';
      await callManager['dequeueWsEvents'](mediaEvent);
      await waitForMsecs(50);
      expect(mediaSpy).toHaveBeenCalled();

      expect(call['mediaStateMachine'].state.value).toStrictEqual('S_ROAP_OK');
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_ESTABLISHED');

      /* Start Call disconnect */
      disconnectEvent.data.correlationId = call.getCorrelationId();
      callManager['dequeueWsEvents'](disconnectEvent);
      await waitForMsecs(50);

      expect(deleteCallMock).toHaveBeenCalled();
      expect(mediaClose).toHaveBeenCalled();
      expect(call['mediaStateMachine'].state.value).toStrictEqual('S_ROAP_TEARDOWN');
      expect(call['callStateMachine'].state.value).toStrictEqual('S_CALL_CLEARED');

      expect(Object.keys(callManager.getActiveCalls()).length).toBe(2);
    });

    patchMock.mockResolvedValue(dummyResponse);
    await callManager['dequeueWsEvents'](setupEvent);
  });
});

describe('Coverage for Events listener', () => {
  let callManager: ICallManager;
  let call: ICall;
  const dummyCallId = '8a67806f-fc4d-4469-a131-31e71ec5b011';

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

  beforeEach(() => {
    callManager = getCallManager(webex, defaultServiceIndicator);
    callManager.removeAllListeners(LINE_EVENT_KEYS.INCOMING_CALL);
    call = callManager.createCall(CallDirection.OUTBOUND, deviceId, mockLineId, dest);
    call.setCallId(dummyCallId);
    setupEvent.data.correlationId = call.getCorrelationId();
  });

  const funcSpy = jest.spyOn(Call.prototype as any, 'sendMediaStateMachineEvt');
  const callSpy = jest.spyOn(Call.prototype as any, 'sendCallStateMachineEvt');
  const logSpy = jest.spyOn(log, 'log');

  it('When Offer is received', async () => {
    mediaEvent.data.callId = dummyCallId;

    await callManager['dequeueWsEvents'](mediaEvent);
    const eventData = {data: mediaEvent.data.message, type: 'E_RECV_ROAP_OFFER'};

    expect(funcSpy).toHaveBeenLastCalledWith(eventData);
  });

  it('When Answer is received', async () => {
    mediaEvent.data.message.messageType = 'ANSWER';
    await callManager['dequeueWsEvents'](mediaEvent);

    const eventData = {data: mediaEvent.data.message, type: 'E_RECV_ROAP_ANSWER'};

    expect(funcSpy).toHaveBeenCalledWith(eventData);
  });

  it('When Offer Request is received', async () => {
    mediaEvent.data.message.messageType = 'OFFER_REQUEST';
    await callManager['dequeueWsEvents'](mediaEvent);

    const eventData = {data: mediaEvent.data.message, type: 'E_RECV_ROAP_OFFER_REQUEST'};

    expect(funcSpy).toHaveBeenCalledWith(eventData);
  });

  it('When OK is received', async () => {
    mediaEvent.data.message.messageType = 'OK';
    await callManager['dequeueWsEvents'](mediaEvent);

    const mediaOK = {received: true, message: mediaEvent.data.message};
    const eventData = {data: mediaOK, type: 'E_ROAP_OK'};

    expect(funcSpy).toHaveBeenCalledWith(eventData);
  });

  it('When Error is Received', async () => {
    mediaEvent.data.message.messageType = 'ERROR';
    await callManager['dequeueWsEvents'](mediaEvent);

    expect(logSpy).toHaveBeenCalledWith('Received Error...', {
      file: 'callManager',
      method: 'dequeueWsEvents',
    });
  });

  it('When Unknown event is Received', async () => {
    mediaEvent.data.message.messageType = 'UNKNOWN';
    await callManager['dequeueWsEvents'](mediaEvent);

    expect(logSpy).toHaveBeenCalledWith('Unknown Media mobiusEvent: UNKNOWN ', {
      file: 'callManager',
      method: 'dequeueWsEvents',
    });
  });

  it('When Progress/Connect event is Received', async () => {
    setupEvent.data.eventType = 'mobius.callprogress';
    await callManager['dequeueWsEvents'](setupEvent);
    expect(callSpy).toHaveBeenCalledWith({type: 'E_RECV_CALL_PROGRESS', data: setupEvent.data});
  });

  it('Silently discard an event in the state machine', async () => {
    call['callStateMachine'].state.value = 'S_SEND_CALL_CONNECT';
    expect(call['callStateMachine'].state.value).toStrictEqual('S_SEND_CALL_CONNECT');

    const connectEvent = JSON.parse(JSON.stringify(setupEvent));

    connectEvent.data.eventType = 'mobius.callconnected';
    await callManager['dequeueWsEvents'](connectEvent);

    /* There should not be any state change */
    expect(call['callStateMachine'].state.value).toStrictEqual('S_SEND_CALL_CONNECT');
  });

  it('Silently discard an ROAP_ANSWER after being in ROAP_OK state', async () => {
    call['mediaStateMachine'].state.value = 'S_ROAP_OK';
    expect(call['mediaStateMachine'].state.value).toStrictEqual('S_ROAP_OK');

    const answerEvent = JSON.parse(JSON.stringify(mediaEvent));

    answerEvent.data.message.messageType = 'ANSWER';
    await callManager['dequeueWsEvents'](answerEvent);

    /* There should not be any state change */
    expect(call['mediaStateMachine'].state.value).toStrictEqual('S_ROAP_OK');
  });

  it('When Unknown Call event is Received', async () => {
    setupEvent.data.eventType = 'mobius.callunknown';
    await callManager['dequeueWsEvents'](setupEvent);
    expect(logSpy).toHaveBeenCalledWith('Unknown Call Event mobiusEvent: mobius.callunknown', {
      file: 'callManager',
      method: 'dequeueWsEvents',
    });
  });
});

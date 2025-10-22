import 'jsdom-global/register';
import {MediaRequestManager} from '@webex/plugin-meetings/src/multistream/mediaRequestManager';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {getMaxFs, getMaxPicSize} from '@webex/plugin-meetings/src/multistream/remoteMedia';
import {MAX_FS_VALUES, MAX_PIC_SIZE_VALUES} from '@webex/plugin-meetings/src/multistream/constants';
import FakeTimers from '@sinonjs/fake-timers';
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import { expect } from 'chai';
import { getFrameSizeFromPicSize, getPicSizeFromFrameSize } from '@webex/plugin-meetings/src/multistream/utils';

type ExpectedActiveSpeaker = {
  policy: 'active-speaker';
  maxPayloadBitsPerSecond?: number;
  priority: number;
  receiveSlots: Array<ReceiveSlot>;
  maxFs?: number;
  maxMbps?: number;
  namedMediaGroups?:[{type: number, value: number}];
  // AV1 specific properties
  maxPicSize?: number;
  levelIdx?: number;
  tier?: number;
  maxDecodeRate?: number;
  codec?: 'h264' | 'av1';
};
type ExpectedReceiverSelected = {
  policy: 'receiver-selected';
  maxPayloadBitsPerSecond?: number;
  csi: number;
  receiveSlot: ReceiveSlot;
  maxFs?: number;
  maxMbps?: number;
  // AV1 specific properties
  maxPicSize?: number;
  levelIdx?: number;
  tier?: number;
  maxDecodeRate?: number;
  codec?: 'h264' | 'av1';
};
type ExpectedRequest = ExpectedActiveSpeaker | ExpectedReceiverSelected;

const degradationPreferences = {
  maxMacroblocksLimit: Infinity, // no limit
};

// AV1 constants
const AV1_LEVEL_IDX_360p = 8;
const AV1_LEVEL_IDX_540p = 9;
const AV1_LEVEL_IDX_720p = 10;
const AV1_LEVEL_IDX_1080p = 11;
const AV1_TIER = 0;
const MAX_DECODE_RATE_360p = 552960;
const MAX_DECODE_RATE_540p = 983040;
const MAX_DECODE_RATE_720p = 2073600;
const MAX_DECODE_RATE_1080p = 4423680;

describe('MediaRequestManager', () => {
  const CROSS_PRIORITY_DUPLICATION = true;
  const CROSS_POLICY_DUPLICATION = true;
  const MAX_FPS = 3000;
  const MAX_FS_360p = 920;
  const MAX_FS_540p = 2040;
  const MAX_FS_720p = 3600;
  const MAX_FS_1080p = 8192;
  const MAX_MBPS_360p = 27600;
  const MAX_MBPS_540p = 61200;
  const MAX_MBPS_720p = 108000;
  const MAX_MBPS_1080p = 245760;
  const MAX_PAYLOADBITSPS_360p = 640000;
  const MAX_PAYLOADBITSPS_540p = 880000;
  const MAX_PAYLOADBITSPS_720p = 2500000;
  const MAX_PAYLOADBITSPS_1080p = 4000000;

  const NUM_SLOTS = 15;

  let mediaRequestManager: MediaRequestManager;
  let sendMediaRequestsCallback;
  let fakeWcmeSlots;
  let fakeReceiveSlots;

  beforeEach(() => {
    sendMediaRequestsCallback = sinon.stub();
    mediaRequestManager = new MediaRequestManager(sendMediaRequestsCallback, {
      degradationPreferences,
      kind: 'video',
      trimRequestsToNumOfSources: false,
    });

    // create some fake receive slots used by the tests
    fakeWcmeSlots = Array(NUM_SLOTS)
      .fill(null)
      .map((_, index) => ({
        id: `fake WCME slot ${index}`,
      }));

    fakeReceiveSlots = Array(NUM_SLOTS)
      .fill(null)
      .map(
        (_, index) =>
          ({
            id: `fake receive slot ${index}`,
            on: sinon.stub(),
            off: sinon.stub(),
            sourceState: 'live',
            wcmeReceiveSlot: fakeWcmeSlots[index],
          } as unknown as ReceiveSlot)
      );
  });

  // helper function for adding an active speaker request
  const addH264ActiveSpeakerRequest = (
    priority,
    receiveSlots,
    maxFs,
    commit = false,
    preferLiveVideo = true,
    namedMediaGroups = undefined
  ) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'active-speaker',
          priority,
          crossPriorityDuplication: CROSS_PRIORITY_DUPLICATION,
          crossPolicyDuplication: CROSS_POLICY_DUPLICATION,
          preferLiveVideo,
          namedMediaGroups,
        },
        receiveSlots,
        codecInfo: {
          codec: 'h264',
          maxFs: maxFs,
        },
      },
      commit
    );

  // helper function for adding a receiver selected request
  const addH264ReceiverSelectedRequest = (csi, receiveSlot, maxFs, commit = false) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi,
        },
        receiveSlots: [receiveSlot],
        codecInfo: {
          codec: 'h264',
          maxFs: maxFs,
        },
      },
      commit
    );

  // helper function for adding an AV1 active speaker request
  const addAv1ActiveSpeakerRequest = (
    priority,
    receiveSlots,
    maxPicSize,
    commit = false,
    preferLiveVideo = true,
    namedMediaGroups = undefined,
    levelIdx = AV1_LEVEL_IDX_720p,
    maxDecodeRate = MAX_DECODE_RATE_720p
  ) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'active-speaker',
          priority,
          crossPriorityDuplication: CROSS_PRIORITY_DUPLICATION,
          crossPolicyDuplication: CROSS_POLICY_DUPLICATION,
          preferLiveVideo,
          namedMediaGroups,
        },
        receiveSlots,
        codecInfo: {
          codec: 'av1',
          maxPicSize,
          levelIdx,
          tier: AV1_TIER,
          maxDecodeRate,
        },
      },
      commit
    );

  // helper function for adding an AV1 receiver selected request
  const addAv1ReceiverSelectedRequest = (
    csi,
    receiveSlot,
    maxPicSize,
    commit = false,
    levelIdx = AV1_LEVEL_IDX_720p,
    maxDecodeRate = MAX_DECODE_RATE_720p
  ) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi,
        },
        receiveSlots: [receiveSlot],
        codecInfo: {
          codec: 'av1',
          maxPicSize: maxPicSize,
          levelIdx,
          tier: AV1_TIER,
          maxDecodeRate,
        },
      },
      commit
    );

  // helper function for verifying that the right active speaker and receiver selected
  // requests have been sent out
  // It should be used only for verifying requests created with
  // addActiveSpeakerRequest() or addReceiverSelectedRequest(), because of some
  // hardcoded values used in them
  const checkMediaRequestsSent = (
    expectedRequests: ExpectedRequest[], {
      isCodecInfoDefined = true,
      preferLiveVideo = true,
    } = {}
  ) => {
    assert.calledOnce(sendMediaRequestsCallback);
    assert.calledWith(
      sendMediaRequestsCallback,
      expectedRequests.map((expectedRequest) => {
        if (expectedRequest.policy === 'active-speaker') {
          const matchObj: any = {
            policy: 'active-speaker',
            policySpecificInfo: sinon.match({
              priority: expectedRequest.priority,
              crossPriorityDuplication: CROSS_PRIORITY_DUPLICATION,
              crossPolicyDuplication: CROSS_POLICY_DUPLICATION,
              preferLiveVideo,
            }),
            receiveSlots: expectedRequest.receiveSlots,
            maxPayloadBitsPerSecond: expectedRequest.maxPayloadBitsPerSecond,
          };

          if (isCodecInfoDefined) {
            if (expectedRequest.codec === 'av1') {
              matchObj.codecInfos = [
                sinon.match({
                  payloadType: 45,
                  codec: sinon.match({
                    levelIdx: expectedRequest.levelIdx,
                    tier: expectedRequest.tier,
                    maxPicSize: expectedRequest.maxPicSize,
                    maxDecodeRate: expectedRequest.maxDecodeRate,
                  }),
                }),
              ];
            } else {
              // Default to H264 for backward compatibility
              matchObj.codecInfos = [
                sinon.match({
                  payloadType: 0x80,
                  codec: sinon.match({
                    maxFs: expectedRequest.maxFs,
                    maxFps: sinon.match.number,
                  }),
                }),
              ];
            }
          } else {
            matchObj.codecInfos = [];
          }

          return sinon.match(matchObj);
        }

        if (expectedRequest.policy === 'receiver-selected') {
          const matchObj: any = {
            policy: 'receiver-selected',
            policySpecificInfo: sinon.match({
              csi: expectedRequest.csi,
            }),
            receiveSlots: [expectedRequest.receiveSlot],
            maxPayloadBitsPerSecond: expectedRequest.maxPayloadBitsPerSecond,
          };

          if (isCodecInfoDefined) {
            if (expectedRequest.codec === 'av1') {
              matchObj.codecInfos = [
                sinon.match({
                  payloadType: 45,
                  codec: sinon.match({
                    levelIdx: expectedRequest.levelIdx,
                    tier: expectedRequest.tier,
                    maxPicSize: expectedRequest.maxPicSize,
                    maxDecodeRate: expectedRequest.maxDecodeRate,
                  }),
                }),
              ];
            } else {
              // Default to H264 for backward compatibility
              matchObj.codecInfos = [
                sinon.match({
                  payloadType: 0x80,
                  codec: sinon.match({
                    maxFs: expectedRequest.maxFs,
                    maxFps: sinon.match.number,
                  }),
                }),
              ];
            }
          } else {
            matchObj.codecInfos = [];
          }

          return sinon.match(matchObj);
        }

        return undefined;
      })
    );
    sendMediaRequestsCallback.resetHistory();
  };

  it('starts with no requests', () => {
    mediaRequestManager.commit();

    assert.calledOnce(sendMediaRequestsCallback);
    assert.calledWith(sendMediaRequestsCallback, []);
  });

  it('sends correct wcme media requests when addRequest() is called with commit=true', () => {
    // this is the only test that doesn't use the helper addActiveSpeakerRequest(), addReceiverSelectedRequest() methods
    // because it tests other values for some of the parameters that are otherwise always fixed by those helpers

    // first call addRequest a couple of times with commit=false
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'active-speaker',
          priority: 255,
          crossPriorityDuplication: true,
          crossPolicyDuplication: false,
          preferLiveVideo: false,
        },
        receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
        codecInfo: {
          codec: 'h264',
          maxFs: MAX_FS_360p,
          maxFps: MAX_FPS,
        },
      },
      false
    );



    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi: 123,
        },
        receiveSlots: [fakeReceiveSlots[3]],
        codecInfo: {
          codec: 'h264',
          maxFs: MAX_FS_720p,
          maxFps: MAX_FPS,
          maxMbps: MAX_MBPS_720p,
        },
      },
      false
    );

    // finally call it with commit=true
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi: 123,
        },
        receiveSlots: [fakeReceiveSlots[4]],
        codecInfo: {
          codec: 'h264',
          maxFs: MAX_FS_1080p,
          maxFps: MAX_FPS,
          maxMbps: MAX_MBPS_1080p,
        },
      },
      true
    );

    // all 3 requests should be sent out together
    assert.calledOnce(sendMediaRequestsCallback);
    assert.calledWith(sendMediaRequestsCallback, [
      sinon.match({
        policy: 'active-speaker',
        policySpecificInfo: sinon.match({
          priority: 255,
          crossPriorityDuplication: true,
          crossPolicyDuplication: false,
          preferLiveVideo: false,
        }),
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1], fakeWcmeSlots[2]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            codec: sinon.match({
              maxFs: MAX_FS_360p,
              maxFps: MAX_FPS,
            }),
          }),
        ],
      }),
      sinon.match({
        policy: 'receiver-selected',
        policySpecificInfo: sinon.match({
          csi: 123,
        }),
        receiveSlots: [fakeWcmeSlots[3]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            codec: sinon.match({
              maxFs: MAX_FS_720p,
              maxFps: MAX_FPS,
            }),
          }),
        ],
      }),
      sinon.match({
        policy: 'receiver-selected',
        policySpecificInfo: sinon.match({
          csi: 123,
        }),
        receiveSlots: [fakeWcmeSlots[4]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            codec: sinon.match({
              maxFs: MAX_FS_1080p,
              maxFps: MAX_FPS,
            }),
          }),
        ],
      }),
    ]);
  });

  it('keeps adding requests with every call to addRequest()', () => {
    // start with 1 request
    addH264ReceiverSelectedRequest(100, fakeReceiveSlots[0], MAX_FS_1080p, true);


    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);

    // now add another one
    addH264ReceiverSelectedRequest(101, fakeReceiveSlots[1], MAX_FS_1080p, true);

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'receiver-selected',
        csi: 101,
        receiveSlot: fakeWcmeSlots[1],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);

    // and one more
    addH264ActiveSpeakerRequest(
      1,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      MAX_FS_720p,
      true
    );

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'receiver-selected',
        csi: 101,
        receiveSlot: fakeWcmeSlots[1],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'active-speaker',
        priority: 1,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
    ]);
  });

  it('removes the events maxFsUpdate and sourceUpdate when cancelRequest() is called', async () => {

    const requestId = addH264ActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]], MAX_FS_720p);

    mediaRequestManager.cancelRequest(requestId, true);

    const sourceUpdateHandler = fakeReceiveSlots[2].off.getCall(0);

    const maxFsHandlerCall = fakeReceiveSlots[2].off.getCall(1);

    const maxFsEventName = maxFsHandlerCall.args[0];
    const sourceUpdateEventName = sourceUpdateHandler.args[0];

    expect(sourceUpdateHandler.args[1]).to.be.a('function');
    expect(maxFsHandlerCall.args[1]).to.be.a('function');

    assert.equal(maxFsEventName, 'maxFsUpdate')
    assert.equal(sourceUpdateEventName, 'sourceUpdate')
  });

  it('cancels the requests correctly when cancelRequest() is called with commit=true', () => {
    const requestIds = [
      addH264ActiveSpeakerRequest(255, [fakeReceiveSlots[0], fakeReceiveSlots[1]], MAX_FS_720p),
      addH264ActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]], MAX_FS_720p),
      addH264ReceiverSelectedRequest(100, fakeReceiveSlots[4], MAX_FS_1080p),
      addH264ReceiverSelectedRequest(200, fakeReceiveSlots[5], MAX_FS_1080p),
    ];

    // cancel one of the active speaker requests
    mediaRequestManager.cancelRequest(requestIds[1], true);

    // expect only the 3 remaining requests to be sent out
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[4],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'receiver-selected',
        csi: 200,
        receiveSlot: fakeWcmeSlots[5],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);

    // cancel one of the receiver selected requests
    mediaRequestManager.cancelRequest(requestIds[3], true);

    // expect only the 2 remaining requests to be sent out
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[4],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);
  });

  it('does not send out anything if addRequest() is called with commit=false', () => {
    addH264ActiveSpeakerRequest(
      10,
      [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
      MAX_FS_720p,
      false
    );
    addH264ReceiverSelectedRequest(123, fakeReceiveSlots[3], MAX_FS_1080p, false);

    // nothing should be sent out as we didn't commit the requests
    assert.notCalled(sendMediaRequestsCallback);

    // now do the commit
    mediaRequestManager.commit();

    // check that the 2 requests have been sent out
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 10,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1], fakeWcmeSlots[2]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'receiver-selected',
        csi: 123,
        receiveSlot: fakeWcmeSlots[3],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);
  });

  it('does not send out anything if cancelRequest() is called with commit=false', () => {
    // send 4 requests
    const requestIds = [
      addH264ActiveSpeakerRequest(
        250,
        [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
        MAX_FS_720p,
        false
      ),
      addH264ReceiverSelectedRequest(98765, fakeReceiveSlots[3], MAX_FS_1080p, false),
      addH264ReceiverSelectedRequest(99999, fakeReceiveSlots[4], MAX_FS_1080p, false),
      addH264ReceiverSelectedRequest(88888, fakeReceiveSlots[5], MAX_FS_1080p, true),
    ];

    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 250,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1], fakeWcmeSlots[2]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'receiver-selected',
        csi: 98765,
        receiveSlot: fakeWcmeSlots[3],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'receiver-selected',
        csi: 99999,
        receiveSlot: fakeWcmeSlots[4],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'receiver-selected',
        csi: 88888,
        receiveSlot: fakeWcmeSlots[5],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);

    // now cancel 3 of them, but with commit=false => nothing should happen
    mediaRequestManager.cancelRequest(requestIds[0], false);
    mediaRequestManager.cancelRequest(requestIds[2], false);
    mediaRequestManager.cancelRequest(requestIds[3], false);

    assert.notCalled(sendMediaRequestsCallback);

    // now do the commit
    mediaRequestManager.commit();

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 98765,
        receiveSlot: fakeWcmeSlots[3],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);
  });

  it('sends the wcme media requests when commit() is called', () => {
    // send some requests, all of them with commit=false
    addH264ReceiverSelectedRequest(123000, fakeReceiveSlots[0], MAX_FS_1080p, false);
    addH264ReceiverSelectedRequest(456000, fakeReceiveSlots[1], MAX_FS_1080p, false);
    addH264ActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      MAX_FS_720p,
      false
    );
    addH264ActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      MAX_FS_720p,
      false
    );
    addH264ActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[8], fakeReceiveSlots[9], fakeReceiveSlots[10]],
      MAX_FS_720p,
      false,
      true,
      [{type: 1, value: 20}],
    );
    // nothing should be sent out as we didn't commit the requests
    assert.notCalled(sendMediaRequestsCallback);

    // now do the commit
    mediaRequestManager.commit();

    // check that all requests have been sent out
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 123000,
        receiveSlot: fakeWcmeSlots[0],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'receiver-selected',
        csi: 456000,
        receiveSlot: fakeWcmeSlots[1],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[8], fakeWcmeSlots[9], fakeWcmeSlots[10]],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: MAX_FS_720p,
        maxMbps: MAX_MBPS_720p,
        namedMediaGroups: [{type: 1, value: 20}],
      },
    ]);
  });

  it('makes sure to call requests correctly after reset was called and another request was added', () => {
    addH264ReceiverSelectedRequest(1500, fakeReceiveSlots[0], MAX_FS_1080p, false);

    assert.notCalled(sendMediaRequestsCallback);

    mediaRequestManager.commit();
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1500,
        receiveSlot: fakeWcmeSlots[0],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);

    // now reset everything
    mediaRequestManager.reset();

    // calling commit now should not cause any requests to be sent out
    mediaRequestManager.commit();
    checkMediaRequestsSent([]);

    //add new request
    addH264ReceiverSelectedRequest(1501, fakeReceiveSlots[1], MAX_FS_1080p, false);

    // commit
    mediaRequestManager.commit();

    // check the new request was sent
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1501,
        receiveSlot: fakeWcmeSlots[1],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);
  });

  it('re-sends media requests after degradation preferences are set', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    assert.calledOnce(sendMediaRequestsCallback);
  });

  it('should not degrade max-fs if receive slot sources are not live', () => {
    // set receive slot source states to "no source"
    fakeReceiveSlots.forEach((slot) => {
      slot.sourceState = 'no source';
    });

    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 4 "large" 1080p streams, which should degrade to 720p if live
    addH264ActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 4), getMaxFs('large'), true);

    // check that resulting requests are 4 "large" 1080p streams
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 4),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: getMaxFs('large'),
        maxMbps: MAX_MBPS_1080p,
      },
    ]);
  });

  it('can degrade max-fs once when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 3 "large" 1080p streams
    addH264ActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 3), getMaxFs('large'), false);

    // request additional "large" 1080p stream to exceed max macroblocks limit
    const additionalRequestId = addH264ReceiverSelectedRequest(
      123,
      fakeReceiveSlots[3],
      getMaxFs('large'),
      true
    );

    // check that resulting requests are 4 "medium" 720p streams
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 3),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: getMaxFs('medium'),
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'receiver-selected',
        csi: 123,
        receiveSlot: fakeWcmeSlots[3],
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: getMaxFs('medium'),
        maxMbps: MAX_MBPS_720p,
      },
    ]);

    // cancel additional request
    mediaRequestManager.cancelRequest(additionalRequestId);

    // check that resulting requests are 3 "large" 1080p streams
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 3),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        maxFs: getMaxFs('large'),
        maxMbps: MAX_MBPS_1080p,
      },
    ]);
  });

  it('can degrade max-fs multiple times when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 10 "large" 1080p streams
    addH264ActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 10), getMaxFs('large'), true);

    // check that resulting requests are 10 540p streams
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 10),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_540p,
        maxFs:  MAX_FS_VALUES['540p'],
        maxMbps: MAX_MBPS_540p,
      },
    ]);
  });

  it('can degrade only the largest max-fs when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 5 "large" 1080p streams and 5 "small" 360p streams
    addH264ActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 5), getMaxFs('large'), false);
    addH264ActiveSpeakerRequest(254, fakeReceiveSlots.slice(5, 10), getMaxFs('small'), true);

    // check that resulting requests are 5 "medium" 720p streams and 5 "small" 360p streams
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 5),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
        maxFs: getMaxFs('medium'),
        maxMbps: MAX_MBPS_720p,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: fakeWcmeSlots.slice(5, 10),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
        maxFs: getMaxFs('small'),
        maxMbps: MAX_MBPS_360p,
      },
    ]);
  });

  it('respects the preferredMaxFs if set', () => {
    sendMediaRequestsCallback.resetHistory();
    const clock = FakeTimers.install({now: Date.now()});

    addH264ActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 10), getMaxFs('large'), true);

    sendMediaRequestsCallback.resetHistory();

    const maxFsHandlerCall = fakeReceiveSlots[0].on.getCall(1);

    const maxFsHandler = maxFsHandlerCall.args[1];
    const eventName = maxFsHandlerCall.args[0];

    assert.equal(eventName, 'maxFsUpdate');

    const preferredFrameSize = 100;

    maxFsHandler({maxFs: preferredFrameSize});

    clock.tick(999);

    assert.notCalled(sendMediaRequestsCallback);

    clock.tick(1);

    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 10),
        maxFs: preferredFrameSize,
        maxPayloadBitsPerSecond: 99000,
        maxMbps: 3000,
      },
    ]);
    clock.uninstall()
  });

  describe('maxPayloadBitsPerSecond', () => {
    let getRecommendedMaxBitrateForFrameSizeSpy;

    beforeEach(() => {
      sendMediaRequestsCallback.resetHistory();
      getRecommendedMaxBitrateForFrameSizeSpy = sinon.spy(
        InternalMediaCoreModule,
        'getRecommendedMaxBitrateForFrameSize'
      );
    });

    afterEach(() => {
      getRecommendedMaxBitrateForFrameSizeSpy.restore();
    });

    it('returns the default maxPayloadBitsPerSecond if kind is "audio"', () => {
      const mediaRequestManagerAudio = new MediaRequestManager(sendMediaRequestsCallback, {
        degradationPreferences,
        kind: 'audio',
        trimRequestsToNumOfSources: false,
      });
      mediaRequestManagerAudio.setNumCurrentSources(100, 100);
      sendMediaRequestsCallback.resetHistory();

      mediaRequestManagerAudio.addRequest(
        {
          policyInfo: {
            policy: 'receiver-selected',
            csi: 123,
          },
          receiveSlots: [fakeReceiveSlots[0]],
          codecInfo: undefined,
        },
        false
      );

      mediaRequestManagerAudio.commit();

      checkMediaRequestsSent(
        [
          {
            policy: 'receiver-selected',
            csi: 123,
            receiveSlot: fakeWcmeSlots[0],
            // returns RecommendedOpusBitrates.FB_MONO_MUSIC as expected:
            maxPayloadBitsPerSecond: 64000,
          },
          // set isCodecInfoDefined to false, since we don't pass in a codec info when audio:
        ],
        {isCodecInfoDefined: false}
      );

      assert.notCalled(getRecommendedMaxBitrateForFrameSizeSpy);
    });

    it('returns the recommended maxPayloadBitsPerSecond if kind is "video"', () => {
      mediaRequestManager.addRequest(
        {
          policyInfo: {
            policy: 'receiver-selected',
            csi: 123,
          },
          receiveSlots: [fakeReceiveSlots[0]],
          codecInfo: {
            codec: 'h264',
            maxFs: MAX_FS_1080p,
            maxFps: MAX_FPS,
            maxMbps: MAX_MBPS_1080p,
          },
        },
        false
      );

      mediaRequestManager.commit();

      checkMediaRequestsSent([
        {
          policy: 'receiver-selected',
          csi: 123,
          receiveSlot: fakeWcmeSlots[0],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
          maxFs: MAX_FS_1080p,
          maxMbps: MAX_MBPS_1080p,
        },
      ]);

      // calls the utility function as expected with maxFs passed in (no need to do
      // further tests here, since the util function itself should be tested for different inputs)
      assert.calledWith(getRecommendedMaxBitrateForFrameSizeSpy, MAX_FS_1080p);
    });
  });

  describe('maxMbps', () => {
    beforeEach(() => {
      sendMediaRequestsCallback.resetHistory();
    });

    it('returns the correct maxMbps value', () => {
      mediaRequestManager.addRequest(
        {
          policyInfo: {
            policy: 'receiver-selected',
            csi: 123,
          },
          receiveSlots: [fakeReceiveSlots[0]],
          codecInfo: {
            codec: 'h264',
            maxFs: MAX_FS_1080p,
            maxFps: MAX_FPS,
            // random value to pass in, to show that the output (below) is calculated
            // from the maxFs and maxFps values only:
            maxMbps: 123,
          },
        },
        false
      );

      mediaRequestManager.commit();

      checkMediaRequestsSent([
        {
          policy: 'receiver-selected',
          csi: 123,
          receiveSlot: fakeWcmeSlots[0],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
          maxFs: MAX_FS_1080p,
          maxMbps: MAX_MBPS_1080p,
        },
      ]);
    });
  });

  describe('trimming of requested receive slots', () => {
    beforeEach(() => {
      mediaRequestManager = new MediaRequestManager(sendMediaRequestsCallback, {
        degradationPreferences,
        kind: 'video',
        trimRequestsToNumOfSources: true,
      });
    });

    const limitNumAvailableStreams = (preferLiveVideo, limit) => {
      if (preferLiveVideo) {
        mediaRequestManager.setNumCurrentSources(100, limit);
      } else {
        mediaRequestManager.setNumCurrentSources(limit, 1);
      }
    };

    [true, false].forEach((preferLiveVideo) =>
      describe(`preferLiveVideo=${preferLiveVideo}`, () => {
        it(`trims the active speaker request with lowest priority first and maintains slot order`, () => {
          // add some receiver-selected and active-speaker requests, in a mixed up order
          addH264ReceiverSelectedRequest(100, fakeReceiveSlots[0], MAX_FS_360p, false);
          addH264ActiveSpeakerRequest( // AS request 1 - it will get 1 slot trimmed
            254,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );
          addH264ActiveSpeakerRequest( // AS request 2 - lowest priority, it will have all slots trimmed
            253,
            [fakeReceiveSlots[7], fakeReceiveSlots[8], fakeReceiveSlots[9]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );
          addH264ActiveSpeakerRequest( // AS request 3 - highest priority, nothing will be trimmed
            255,
            [fakeReceiveSlots[4], fakeReceiveSlots[5], fakeReceiveSlots[6]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );
          addH264ReceiverSelectedRequest(101, fakeReceiveSlots[10], MAX_FS_360p, false);

          /* Set number of available streams to 7 so that there will be enough sources only for
            the 2 RS requests and 2 of the 3 AS requests. The lowest priority AS request will
            have all the slots trimmed, the second lowest priority AS request will have 1 slot trimmed */
          limitNumAvailableStreams(preferLiveVideo, 7);

          // check what got trimmed
          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 100,
              receiveSlot: fakeWcmeSlots[0],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'active-speaker',
              priority: 254,
              receiveSlots: [fakeWcmeSlots[1], fakeWcmeSlots[2]], // fakeWcmeSlots[3] got trimmed
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            // AS request with priority 253 is missing, because all of its slots got trimmed
            {
              policy: 'active-speaker',
              priority: 255,
              receiveSlots: [fakeWcmeSlots[4], fakeWcmeSlots[5], fakeWcmeSlots[6]],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'receiver-selected',
              csi: 101,
              receiveSlot: fakeWcmeSlots[10],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
          ], {preferLiveVideo});

          // now increase the number of available streams so only the last AS request is trimmed by 1
          limitNumAvailableStreams(preferLiveVideo, 10);

          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 100,
              receiveSlot: fakeWcmeSlots[0],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'active-speaker',
              priority: 254,
              receiveSlots: [fakeWcmeSlots[1], fakeWcmeSlots[2], fakeWcmeSlots[3]], // all slots are used, nothing trimmed
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'active-speaker',
              priority: 253,
              receiveSlots: [fakeWcmeSlots[7], fakeWcmeSlots[8]], // only 1 slot is trimmed
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'active-speaker',
              priority: 255,
              receiveSlots: [fakeWcmeSlots[4], fakeWcmeSlots[5], fakeWcmeSlots[6]], // all slots are used, nothing trimmed
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'receiver-selected',
              csi: 101,
              receiveSlot: fakeWcmeSlots[10],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
          ], {preferLiveVideo});
        })

        it('does not trim the receiver selected requests', async () => {
          // add some receiver-selected and active-speaker requests, in a mixed up order
          addH264ReceiverSelectedRequest(200, fakeReceiveSlots[0], MAX_FS_360p, false);
          addH264ActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );
          addH264ReceiverSelectedRequest(201, fakeReceiveSlots[4], MAX_FS_720p, false);
          addH264ActiveSpeakerRequest(
            254,
            [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
            MAX_FS_720p,
            false,
            preferLiveVideo
          );

          /* Set number of available streams to 1, which is lower than the number of RS requests,
            so all AS requests will be trimmed to 0 but RS requests should be unaltered */
          limitNumAvailableStreams(preferLiveVideo, 1);

          // check what got trimmed - only RS requests should remain
          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 200,
              receiveSlot: fakeWcmeSlots[0],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'receiver-selected',
              csi: 201,
              receiveSlot: fakeWcmeSlots[4],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
              maxFs: MAX_FS_720p,
              maxMbps: MAX_MBPS_720p,
            },
          ], {preferLiveVideo});
        });

        it('does trimming first and applies degradationPreferences after that', async () => {
          // add some receiver-selected and active-speaker requests
          addH264ReceiverSelectedRequest(200, fakeReceiveSlots[0], MAX_FS_360p, false);
          addH264ActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );
          addH264ReceiverSelectedRequest(201, fakeReceiveSlots[4], MAX_FS_720p, false);
          addH264ActiveSpeakerRequest(
            254,
            [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
            MAX_FS_720p,
            false,
            preferLiveVideo
          );

          // Set maxMacroblocksLimit to a value that's big enough just for the 2 RS requests and 1 AS with 1 slot of 360p.
          // but not big enough for all of the RS and AS requests. If maxMacroblocksLimit
          // was applied first, the resolution of all requests (including RS ones) would be degraded
          // This test verifies that it's not happening and the resolutions are not affected.
          mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: MAX_FS_360p + MAX_FS_720p + MAX_FS_360p});
          sendMediaRequestsCallback.resetHistory();

          /* Limit the num of streams so that only 2 RS requests and 1 AS with 1 slot can be sent out */
          limitNumAvailableStreams(preferLiveVideo, 3);

          // check what got trimmed - the remaining requests should have unchanged resolutions
          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 200,
              receiveSlot: fakeWcmeSlots[0],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'active-speaker',
              priority: 255,
              receiveSlots: [fakeWcmeSlots[1]],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
            {
              policy: 'receiver-selected',
              csi: 201,
              receiveSlot: fakeWcmeSlots[4],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
              maxFs: MAX_FS_720p,
              maxMbps: MAX_MBPS_720p,
            },
          ], {preferLiveVideo});
        });

        it('trims all AS requests completely until setNumCurrentSources() is called with non-zero values', async () => {
          // add some receiver-selected and active-speaker requests
          addH264ReceiverSelectedRequest(200, fakeReceiveSlots[0], MAX_FS_360p, false);
          addH264ActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );
          addH264ActiveSpeakerRequest(
            254,
            [fakeReceiveSlots[5]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );

          mediaRequestManager.commit();

          // we're not calling setNumCurrentSources(), so it should use the initial values of 0 for sources count
          // and completely trim all AS requests to 0
          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 200,
              receiveSlot: fakeWcmeSlots[0],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
          ], {preferLiveVideo});
        });

        it('resets num of sources to 0 when reset() is called', async () => {
          // set available streams to non-zero value
          limitNumAvailableStreams(preferLiveVideo, 4);
          sendMediaRequestsCallback.resetHistory();

          // do the reset
          mediaRequestManager.reset();

          // add some receiver-selected and active-speaker requests
          addH264ReceiverSelectedRequest(200, fakeReceiveSlots[0], MAX_FS_360p, false);
          addH264ActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            MAX_FS_360p,
            false,
            preferLiveVideo
          );

          mediaRequestManager.commit();

          // verify that AS request was trimmed to 0, because we've reset mediaRequestManager so available streams count is 0 now
          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 200,
              receiveSlot: fakeWcmeSlots[0],
              maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
              maxFs: MAX_FS_360p,
              maxMbps: MAX_MBPS_360p,
            },
          ], {preferLiveVideo});
        });
      })
    );


    it('throws if there are 2 active-speaker requests with different preferLiveVideo values', () => {
      addH264ActiveSpeakerRequest(
        255,
        [fakeReceiveSlots[0]],
        MAX_FS_360p,
        false,
        true
      );
      addH264ReceiverSelectedRequest(201, fakeReceiveSlots[4], MAX_FS_720p, false);
      addH264ActiveSpeakerRequest(
        254,
        [fakeReceiveSlots[2]],
        MAX_FS_360p,
        false,
        false
      );

      assert.throws(() => mediaRequestManager.commit(), 'a mix of active-speaker groups with different values for preferLiveVideo is not supported');
    })
  });

  describe('AV1 codec support', () => {
    it('sends correct AV1 media requests when addRequest() is called with AV1 codec', () => {
      // Add AV1 active speaker request
      addAv1ActiveSpeakerRequest(
        255,
        [fakeReceiveSlots[0], fakeReceiveSlots[1]],
        MAX_PIC_SIZE_VALUES['720p'],
        false,
        true,
        undefined,
        AV1_LEVEL_IDX_720p,
        MAX_DECODE_RATE_720p
      );

      // Add AV1 receiver selected request
      addAv1ReceiverSelectedRequest(
        123,
        fakeReceiveSlots[2],
        MAX_PIC_SIZE_VALUES['1080p'],
        true,
        AV1_LEVEL_IDX_1080p,
        MAX_DECODE_RATE_1080p
      );


      // Verify both AV1 requests are sent correctly
      checkMediaRequestsSent([
        {
          policy: 'active-speaker',
          priority: 255,
          receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
          maxPicSize: MAX_PIC_SIZE_VALUES['720p'],
          levelIdx: AV1_LEVEL_IDX_720p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_720p,
          codec: 'av1',
        },
        {
          policy: 'receiver-selected',
          csi: 123,
          receiveSlot: fakeWcmeSlots[2],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
          maxPicSize: MAX_PIC_SIZE_VALUES['1080p'],
          levelIdx: AV1_LEVEL_IDX_1080p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_1080p,
          codec: 'av1',
        },
      ]);
    });

    it('degrades AV1 maxPicSize when exceeding macroblocks limit', () => {
      // Set max macroblocks limit
      mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
      sendMediaRequestsCallback.resetHistory();

      // Request multiple AV1 streams that exceed the limit
      addAv1ActiveSpeakerRequest(
        255,
        fakeReceiveSlots.slice(0, 4),
        getMaxPicSize('large'), // This should be degraded
        true,
        true,
        undefined,
        AV1_LEVEL_IDX_1080p,
        MAX_DECODE_RATE_1080p
      );

      // Check that resulting requests have degraded maxPicSize
      checkMediaRequestsSent([
        {
          policy: 'active-speaker',
          priority: 255,
          receiveSlots: fakeWcmeSlots.slice(0, 4),
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
          maxPicSize: getMaxPicSize('medium'), // Should be degraded
          levelIdx: AV1_LEVEL_IDX_1080p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_1080p,
          codec: 'av1',
        },
      ]);
    });

    it('calculates correct maxPayloadBitsPerSecond for AV1 codec', () => {
      const getRecommendedMaxBitrateForFrameSizeSpy = sinon.spy(
        InternalMediaCoreModule,
        'getRecommendedMaxBitrateForFrameSize'
      );

      addAv1ReceiverSelectedRequest(
        456,
        fakeReceiveSlots[0],
        MAX_PIC_SIZE_VALUES['720p'],
        true,
        AV1_LEVEL_IDX_720p,
        MAX_DECODE_RATE_720p
      );

      checkMediaRequestsSent([
        {
          policy: 'receiver-selected',
          csi: 456,
          receiveSlot: fakeWcmeSlots[0],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
          maxPicSize: MAX_PIC_SIZE_VALUES['720p'],
          levelIdx: AV1_LEVEL_IDX_720p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_720p,
          codec: 'av1',
        },
      ]);

      // Verify the utility function was called with AV1 maxPicSize
      assert.calledWith(getRecommendedMaxBitrateForFrameSizeSpy, getFrameSizeFromPicSize(MAX_PIC_SIZE_VALUES['720p']));
      getRecommendedMaxBitrateForFrameSizeSpy.restore();
    });

    it('handles mixed H264 and AV1 requests correctly', () => {
      // Add H264 request
      addH264ActiveSpeakerRequest(255, [fakeReceiveSlots[0]], MAX_FS_720p, false);

      // Add AV1 request
      addAv1ReceiverSelectedRequest(
        789,
        fakeReceiveSlots[1],
        MAX_PIC_SIZE_VALUES['1080p'],
        true,
        AV1_LEVEL_IDX_1080p,
        MAX_DECODE_RATE_1080p
      );

      // Verify both H264 and AV1 requests are handled correctly
      checkMediaRequestsSent([
        {
          policy: 'active-speaker',
          priority: 255,
          receiveSlots: [fakeWcmeSlots[0]],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
          maxFs: MAX_FS_720p,
          maxMbps: MAX_MBPS_720p,
          codec: 'h264',
        },
        {
          policy: 'receiver-selected',
          csi: 789,
          receiveSlot: fakeWcmeSlots[1],
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
          maxPicSize: MAX_PIC_SIZE_VALUES['1080p'],
          levelIdx: AV1_LEVEL_IDX_1080p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_1080p,
          codec: 'av1',
        },
      ]);
    });

    it('degrades AV1 and H264 requests separately based on their codec type', () => {
      // Set max macroblocks limit that will trigger degradation
      mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
      sendMediaRequestsCallback.resetHistory();

      // Add multiple H264 requests
      addH264ActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 3), getMaxFs('large'), false);

      // Add AV1 request that should also be degraded
      addAv1ActiveSpeakerRequest(
        254,
        fakeReceiveSlots.slice(3, 5),
        getMaxPicSize('large'),
        true,
        true,
        undefined,
        AV1_LEVEL_IDX_1080p,
        MAX_DECODE_RATE_1080p
      );

      // Both H264 and AV1 requests should be degraded
      checkMediaRequestsSent([
        {
          policy: 'active-speaker',
          priority: 255,
          receiveSlots: fakeWcmeSlots.slice(0, 3),
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
          maxFs: getMaxFs('medium'), // H264 degraded
          maxMbps: MAX_MBPS_720p,
          codec: 'h264',
        },
        {
          policy: 'active-speaker',
          priority: 254,
          receiveSlots: fakeWcmeSlots.slice(3, 5),
          maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_720p,
          maxPicSize: getMaxPicSize('medium'), // AV1 degraded
          levelIdx: AV1_LEVEL_IDX_1080p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_1080p,
          codec: 'av1',
        },
      ]);
    });

    it('respects preferredMaxFs for AV1 requests', () => {
      const clock = FakeTimers.install({now: Date.now()});

      addAv1ActiveSpeakerRequest(
        255,
        [fakeReceiveSlots[0]],
        getMaxPicSize('large'),
        true,
        true,
        undefined,
        AV1_LEVEL_IDX_1080p,
        MAX_DECODE_RATE_1080p
      );

      sendMediaRequestsCallback.resetHistory();

      const maxFsHandlerCall = fakeReceiveSlots[0].on.getCall(1);
      const maxFsHandler = maxFsHandlerCall.args[1];

      const preferredPicSize = 100 * 256;
      maxFsHandler({maxFs: preferredPicSize});

      clock.tick(1000);

      checkMediaRequestsSent([
        {
          policy: 'active-speaker',
          priority: 255,
          receiveSlots: [fakeWcmeSlots[0]],
          maxPicSize: preferredPicSize,
          maxPayloadBitsPerSecond: 99000,
          levelIdx: AV1_LEVEL_IDX_1080p,
          tier: AV1_TIER,
          maxDecodeRate: MAX_DECODE_RATE_1080p,
          codec: 'av1',
        },
      ]);

      clock.uninstall();
    });
  });
});

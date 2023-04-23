import {MediaRequestManager} from '@webex/plugin-meetings/src/multistream/mediaRequestManager';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {getMaxFs} from '@webex/plugin-meetings/src/multistream/remoteMedia';
import FakeTimers from '@sinonjs/fake-timers';
import * as mediaCore from '@webex/internal-media-core';

type ExpectedActiveSpeaker = {
  policy: 'active-speaker';
  maxPayloadBitsPerSecond?: number;
  priority: number;
  receiveSlots: Array<ReceiveSlot>;
  maxFs?: number;
  maxMbps?: number;
};
type ExpectedReceiverSelected = {
  policy: 'receiver-selected';
  maxPayloadBitsPerSecond?: number;
  csi: number;
  receiveSlot: ReceiveSlot;
  maxFs?: number;
  maxMbps?: number;
};
type ExpectedRequest = ExpectedActiveSpeaker | ExpectedReceiverSelected;

const degradationPreferences = {
  maxMacroblocksLimit: Infinity, // no limit
};

describe('MediaRequestManager', () => {
  const CROSS_PRIORITY_DUPLICATION = true;
  const CROSS_POLICY_DUPLICATION = true;
  const PREFER_LIVE_VIDEO = true;
  const MAX_FPS = 3000;
  const MAX_FS_360p = 920;
  const MAX_FS_720p = 3600;
  const MAX_FS_1080p = 8192;
  const MAX_MBPS_360p = 27600;
  const MAX_MBPS_720p = 108000;
  const MAX_MBPS_1080p = 245760;
  const MAX_PAYLOADBITSPS_360p = 640000;
  const MAX_PAYLOADBITSPS_720p = 2500000;
  const MAX_PAYLOADBITSPS_1080p = 4000000;

  const NUM_SLOTS = 10;

  let mediaRequestManager: MediaRequestManager;
  let sendMediaRequestsCallback;
  let fakeWcmeSlots;
  let fakeReceiveSlots;

  beforeEach(() => {
    sendMediaRequestsCallback = sinon.stub();
    mediaRequestManager = new MediaRequestManager(sendMediaRequestsCallback, {
      degradationPreferences,
      kind: 'video',
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
  const addActiveSpeakerRequest = (priority, receiveSlots, maxFs, commit = false) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'active-speaker',
          priority,
          crossPriorityDuplication: CROSS_PRIORITY_DUPLICATION,
          crossPolicyDuplication: CROSS_POLICY_DUPLICATION,
          preferLiveVideo: PREFER_LIVE_VIDEO,
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
  const addReceiverSelectedRequest = (csi, receiveSlot, maxFs, commit = false) =>
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

  // helper function for verifying that the right active speaker and receiver selected
  // requests have been sent out
  // It should be used only for verifying requests created with
  // addActiveSpeakerRequest() or addReceiverSelectedRequest(), because of some
  // hardcoded values used in them
  const checkMediaRequestsSent = (
    expectedRequests: ExpectedRequest[],
    isCodecInfoDefined: boolean = true
  ) => {
    assert.calledOnce(sendMediaRequestsCallback);
    assert.calledWith(
      sendMediaRequestsCallback,
      expectedRequests.map((expectedRequest) => {
        if (expectedRequest.policy === 'active-speaker') {
          return sinon.match({
            policy: 'active-speaker',
            policySpecificInfo: sinon.match({
              priority: expectedRequest.priority,
              crossPriorityDuplication: CROSS_PRIORITY_DUPLICATION,
              crossPolicyDuplication: CROSS_POLICY_DUPLICATION,
              preferLiveVideo: PREFER_LIVE_VIDEO,
            }),
            receiveSlots: expectedRequest.receiveSlots,
            maxPayloadBitsPerSecond: expectedRequest.maxPayloadBitsPerSecond,
            codecInfos: isCodecInfoDefined
              ? [
                  sinon.match({
                    payloadType: 0x80,
                    h264: sinon.match({
                      maxMbps: expectedRequest.maxMbps,
                      maxFs: expectedRequest.maxFs,
                    }),
                  }),
                ]
              : [],
          });
        }
        if (expectedRequest.policy === 'receiver-selected') {
          return sinon.match({
            policy: 'receiver-selected',
            policySpecificInfo: sinon.match({
              csi: expectedRequest.csi,
            }),
            receiveSlots: [expectedRequest.receiveSlot],
            maxPayloadBitsPerSecond: expectedRequest.maxPayloadBitsPerSecond,
            codecInfos: isCodecInfoDefined
              ? [
                  sinon.match({
                    payloadType: 0x80,
                    h264: sinon.match({
                      maxMbps: expectedRequest.maxMbps,
                      maxFs: expectedRequest.maxFs,
                    }),
                  }),
                ]
              : [],
          });
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
            h264: sinon.match({
              maxFs: MAX_FS_360p,
              maxFps: MAX_FPS,
              maxMbps: MAX_MBPS_360p,
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
            h264: sinon.match({
              maxFs: MAX_FS_720p,
              maxFps: MAX_FPS,
              maxMbps: MAX_MBPS_720p,
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
            h264: sinon.match({
              maxFs: MAX_FS_1080p,
              maxFps: MAX_FPS,
              maxMbps: MAX_MBPS_1080p,
            }),
          }),
        ],
      }),
    ]);
  });

  it('keeps adding requests with every call to addRequest()', () => {
    // start with 1 request
    addReceiverSelectedRequest(100, fakeReceiveSlots[0], MAX_FS_1080p, true);

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
    addReceiverSelectedRequest(101, fakeReceiveSlots[1], MAX_FS_1080p, true);

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
    addActiveSpeakerRequest(
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

  it('cancels the requests correctly when cancelRequest() is called with commit=true', () => {
    const requestIds = [
      addActiveSpeakerRequest(255, [fakeReceiveSlots[0], fakeReceiveSlots[1]], MAX_FS_720p),
      addActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]], MAX_FS_720p),
      addReceiverSelectedRequest(100, fakeReceiveSlots[4], MAX_FS_1080p),
      addReceiverSelectedRequest(200, fakeReceiveSlots[5], MAX_FS_1080p),
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
    addActiveSpeakerRequest(
      10,
      [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
      MAX_FS_720p,
      false
    );
    addReceiverSelectedRequest(123, fakeReceiveSlots[3], MAX_FS_1080p, false);

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
      addActiveSpeakerRequest(
        250,
        [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
        MAX_FS_720p,
        false
      ),
      addReceiverSelectedRequest(98765, fakeReceiveSlots[3], MAX_FS_1080p, false),
      addReceiverSelectedRequest(99999, fakeReceiveSlots[4], MAX_FS_1080p, false),
      addReceiverSelectedRequest(88888, fakeReceiveSlots[5], MAX_FS_1080p, true),
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
    addReceiverSelectedRequest(123000, fakeReceiveSlots[0], MAX_FS_1080p, false);
    addReceiverSelectedRequest(456000, fakeReceiveSlots[1], MAX_FS_1080p, false);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      MAX_FS_720p,
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      MAX_FS_720p,
      false
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
    ]);
  });

  it('avoids sending duplicate requests and clears all the requests on reset()', () => {
    // send some requests and commit them one by one
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], MAX_FS_1080p, false);
    addReceiverSelectedRequest(1501, fakeReceiveSlots[1], MAX_FS_1080p, false);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      MAX_FS_720p,
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      MAX_FS_720p,
      false
    );

    // nothing should be sent out as we didn't commit the requests
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
      {
        policy: 'receiver-selected',
        csi: 1501,
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
    ]);

    // check that when calling commit()
    // all requests are not re-sent again (avoid duplicate requests)
    mediaRequestManager.commit();

    assert.notCalled(sendMediaRequestsCallback);

    // now reset everything
    mediaRequestManager.reset();

    // calling commit now should not cause any requests to be sent out
    mediaRequestManager.commit();
    checkMediaRequestsSent([]);
  });

  it('makes sure to call requests correctly after reset was called and another request was added', () => {
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], MAX_FS_1080p, false);

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
    addReceiverSelectedRequest(1501, fakeReceiveSlots[1], MAX_FS_1080p, false);

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

  it('can send same media request after previous requests have been cleared', () => {
    // add a request and commit
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], MAX_FS_1080p, false);
    mediaRequestManager.commit();
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1500,
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        receiveSlot: fakeWcmeSlots[0],
        maxFs: MAX_FS_1080p,
        maxMbps: MAX_MBPS_1080p,
      },
    ]);

    // clear previous requests
    mediaRequestManager.clearPreviousRequests();

    // commit same request
    mediaRequestManager.commit();

    // check the request was sent
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1500,
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_1080p,
        receiveSlot: fakeWcmeSlots[0],
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
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 4), getMaxFs('large'), true);

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
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 3), getMaxFs('large'), false);

    // request additional "large" 1080p stream to exceed max macroblocks limit
    const additionalRequestId = addReceiverSelectedRequest(
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
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 10), getMaxFs('large'), true);

    // check that resulting requests are 10 "small" 360p streams
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 10),
        maxPayloadBitsPerSecond: MAX_PAYLOADBITSPS_360p,
        maxFs: getMaxFs('small'),
        maxMbps: MAX_MBPS_360p,
      },
    ]);
  });

  it('can degrade only the largest max-fs when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 5 "large" 1080p streams and 5 "small" 360p streams
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 5), getMaxFs('large'), false);
    addActiveSpeakerRequest(254, fakeReceiveSlots.slice(5, 10), getMaxFs('small'), true);

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

    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 10), getMaxFs('large'), true);

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
  });

  describe('maxPayloadBitsPerSecond', () => {
    let getRecommendedMaxBitrateForFrameSizeSpy;

    beforeEach(() => {
      sendMediaRequestsCallback.resetHistory();
      getRecommendedMaxBitrateForFrameSizeSpy = sinon.spy(
        mediaCore,
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
      });
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
        false
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
});

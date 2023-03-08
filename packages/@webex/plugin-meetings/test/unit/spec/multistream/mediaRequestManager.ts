import {MediaRequestManager} from '@webex/plugin-meetings/src/multistream/mediaRequestManager';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {getMaxFs} from '@webex/plugin-meetings/src/multistream/remoteMedia';
import FakeTimers from '@sinonjs/fake-timers';

type ExpectedActiveSpeaker = {
  policy: 'active-speaker';
  priority: number;
  receiveSlots: Array<ReceiveSlot>;
  maxFs: number;
};
type ExpectedReceiverSelected = {
  policy: 'receiver-selected';
  csi: number;
  receiveSlot: ReceiveSlot;
  maxFs: number;
};
type ExpectedRequest = ExpectedActiveSpeaker | ExpectedReceiverSelected;

const maxPayloadBitsPerSecond = 10 * 1000 * 1000; // for now we always send this fixed constant

const degradationPreferences = {
  maxMacroblocksLimit: Infinity, // no limit
};

describe('MediaRequestManager', () => {
  const CROSS_PRIORITY_DUPLICATION = true;
  const CROSS_POLICY_DUPLICATION = true;
  const PREFER_LIVE_VIDEO = true;
  const ACTIVE_SPEAKER_MAX_FS = 3600;
  const RECEIVER_SELECTED_MAX_FS = 8190;

  const NUM_SLOTS = 10;

  let mediaRequestManager: MediaRequestManager;
  let sendMediaRequestsCallback;
  let fakeWcmeSlots;
  let fakeReceiveSlots;

  beforeEach(() => {
    sendMediaRequestsCallback = sinon.stub();
    mediaRequestManager = new MediaRequestManager(
      degradationPreferences,
      sendMediaRequestsCallback
    );

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
  const checkMediaRequestsSent = (expectedRequests: ExpectedRequest[]) => {
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
            maxPayloadBitsPerSecond,
            codecInfos: [
              sinon.match({
                payloadType: 0x80,
                h264: sinon.match({
                  maxFs: expectedRequest.maxFs,
                }),
              }),
            ],
          });
        }
        if (expectedRequest.policy === 'receiver-selected') {
          return sinon.match({
            policy: 'receiver-selected',
            policySpecificInfo: sinon.match({
              csi: expectedRequest.csi,
            }),
            receiveSlots: [expectedRequest.receiveSlot],
            maxPayloadBitsPerSecond,
            codecInfos: [
              sinon.match({
                payloadType: 0x80,
                h264: sinon.match({
                  maxFs: expectedRequest.maxFs,
                }),
              }),
            ],
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
          maxFs: 1620,
          maxFps: 1500,
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
          maxFs: 3600,
          maxFps: 2500,
          maxMbps: 90000,
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
          maxFs: 8192,
          maxFps: 2500,
          maxMbps: 204800,
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
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 1620,
              maxFps: 1500,
              maxMbps: 245760,
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
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 3600,
              maxFps: 2500,
              maxMbps: 90000,
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
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 8192,
              maxFps: 2500,
              maxMbps: 204800,
            }),
          }),
        ],
      }),
    ]);
  });

  it('keeps adding requests with every call to addRequest()', () => {
    // start with 1 request
    addReceiverSelectedRequest(100, fakeReceiveSlots[0], RECEIVER_SELECTED_MAX_FS, true);

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
    ]);

    // now add another one
    addReceiverSelectedRequest(101, fakeReceiveSlots[1], RECEIVER_SELECTED_MAX_FS, true);

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 101,
        receiveSlot: fakeWcmeSlots[1],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
    ]);

    // and one more
    addActiveSpeakerRequest(
      1,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      ACTIVE_SPEAKER_MAX_FS,
      true
    );

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 101,
        receiveSlot: fakeWcmeSlots[1],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'active-speaker',
        priority: 1,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
    ]);
  });

  it('cancels the requests correctly when cancelRequest() is called with commit=true', () => {
    const requestIds = [
      addActiveSpeakerRequest(
        255,
        [fakeReceiveSlots[0], fakeReceiveSlots[1]],
        ACTIVE_SPEAKER_MAX_FS
      ),
      addActiveSpeakerRequest(
        255,
        [fakeReceiveSlots[2], fakeReceiveSlots[3]],
        ACTIVE_SPEAKER_MAX_FS
      ),
      addReceiverSelectedRequest(100, fakeReceiveSlots[4], RECEIVER_SELECTED_MAX_FS),
      addReceiverSelectedRequest(200, fakeReceiveSlots[5], RECEIVER_SELECTED_MAX_FS),
    ];

    // cancel one of the active speaker requests
    mediaRequestManager.cancelRequest(requestIds[1], true);

    // expect only the 3 remaining requests to be sent out
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[4],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 200,
        receiveSlot: fakeWcmeSlots[5],
        maxFs: RECEIVER_SELECTED_MAX_FS,
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
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[4],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
    ]);
  });

  it('does not send out anything if addRequest() is called with commit=false', () => {
    addActiveSpeakerRequest(
      10,
      [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
      ACTIVE_SPEAKER_MAX_FS,
      false
    );
    addReceiverSelectedRequest(123, fakeReceiveSlots[3], RECEIVER_SELECTED_MAX_FS, false);

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
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 123,
        receiveSlot: fakeWcmeSlots[3],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
    ]);
  });

  it('does not send out anything if cancelRequest() is called with commit=false', () => {
    // send 4 requests
    const requestIds = [
      addActiveSpeakerRequest(
        250,
        [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
        ACTIVE_SPEAKER_MAX_FS,
        false
      ),
      addReceiverSelectedRequest(98765, fakeReceiveSlots[3], RECEIVER_SELECTED_MAX_FS, false),
      addReceiverSelectedRequest(99999, fakeReceiveSlots[4], RECEIVER_SELECTED_MAX_FS, false),
      addReceiverSelectedRequest(88888, fakeReceiveSlots[5], RECEIVER_SELECTED_MAX_FS, true),
    ];

    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 250,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1], fakeWcmeSlots[2]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 98765,
        receiveSlot: fakeWcmeSlots[3],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 99999,
        receiveSlot: fakeWcmeSlots[4],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 88888,
        receiveSlot: fakeWcmeSlots[5],
        maxFs: RECEIVER_SELECTED_MAX_FS,
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
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
    ]);
  });

  it('sends the wcme media requests when commit() is called', () => {
    // send some requests, all of them with commit=false
    addReceiverSelectedRequest(123000, fakeReceiveSlots[0], RECEIVER_SELECTED_MAX_FS, false);
    addReceiverSelectedRequest(456000, fakeReceiveSlots[1], RECEIVER_SELECTED_MAX_FS, false);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      ACTIVE_SPEAKER_MAX_FS,
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      ACTIVE_SPEAKER_MAX_FS,
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
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 456000,
        receiveSlot: fakeWcmeSlots[1],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
    ]);
  });

  it('clears all the requests on reset()', () => {
    // send some requests and commit them one by one
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], RECEIVER_SELECTED_MAX_FS, true);
    addReceiverSelectedRequest(1501, fakeReceiveSlots[1], RECEIVER_SELECTED_MAX_FS, true);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      ACTIVE_SPEAKER_MAX_FS,
      true
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      ACTIVE_SPEAKER_MAX_FS,
      true
    );

    sendMediaRequestsCallback.resetHistory();

    // check that when calling commit() all requests are re-sent again
    mediaRequestManager.commit();

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1500,
        receiveSlot: fakeWcmeSlots[0],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'receiver-selected',
        csi: 1501,
        receiveSlot: fakeWcmeSlots[1],
        maxFs: RECEIVER_SELECTED_MAX_FS,
      },
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
        maxFs: ACTIVE_SPEAKER_MAX_FS,
      },
    ]);

    // now reset everything
    mediaRequestManager.reset();

    // calling commit now should not cause any requests to be sent out
    mediaRequestManager.commit();
    checkMediaRequestsSent([]);
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
        maxFs: getMaxFs('large'),
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
        maxFs: getMaxFs('medium'),
      },
      {
        policy: 'receiver-selected',
        csi: 123,
        receiveSlot: fakeWcmeSlots[3],
        maxFs: getMaxFs('medium'),
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
        maxFs: getMaxFs('large'),
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
        maxFs: getMaxFs('small'),
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
        maxFs: getMaxFs('medium'),
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: fakeWcmeSlots.slice(5, 10),
        maxFs: getMaxFs('small'),
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
      },
    ]);
  });

});

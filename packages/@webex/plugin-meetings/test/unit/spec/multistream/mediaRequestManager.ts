import {MediaRequestManager} from '@webex/plugin-meetings/src/multistream/mediaRequestManager';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

type ExpectedActiveSpeaker = {
  policy: 'active-speaker';
  priority: number;
  receiveSlots: Array<ReceiveSlot>;
};
type ExpectedReceiverSelected = {
  policy: 'receiver-selected';
  csi: number;
  receiveSlot: ReceiveSlot;
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
            wcmeReceiveSlot: fakeWcmeSlots[index],
            resetSourceState: sinon.stub(),
          } as unknown as ReceiveSlot)
      );
  });

  // helper function for adding an active speaker request
  const addActiveSpeakerRequest = (priority, receiveSlots, commit = false) =>
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
          maxFs: ACTIVE_SPEAKER_MAX_FS,
        },
      },
      commit
    );

  // helper function for adding a receiver selected request
  const addReceiverSelectedRequest = (csi, receiveSlot, commit = false) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi,
        },
        receiveSlots: [receiveSlot],
        codecInfo: {
          codec: 'h264',
          maxFs: RECEIVER_SELECTED_MAX_FS,
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
                  maxFs: ACTIVE_SPEAKER_MAX_FS,
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
                  maxFs: RECEIVER_SELECTED_MAX_FS,
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
    addReceiverSelectedRequest(100, fakeReceiveSlots[0], true);

    checkMediaRequestsSent([
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[0]},
    ]);

    // now add another one
    addReceiverSelectedRequest(101, fakeReceiveSlots[1], true);

    checkMediaRequestsSent([
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[0]},
      {policy: 'receiver-selected', csi: 101, receiveSlot: fakeWcmeSlots[1]},
    ]);

    // and one more
    addActiveSpeakerRequest(
      1,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      true
    );

    checkMediaRequestsSent([
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[0]},
      {policy: 'receiver-selected', csi: 101, receiveSlot: fakeWcmeSlots[1]},
      {
        policy: 'active-speaker',
        priority: 1,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
      },
    ]);
  });

  it('cancels the requests correctly when cancelRequest() is called with commit=true', () => {
    const requestIds = [
      addActiveSpeakerRequest(255, [fakeReceiveSlots[0], fakeReceiveSlots[1]]),
      addActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]]),
      addReceiverSelectedRequest(100, fakeReceiveSlots[4]),
      addReceiverSelectedRequest(200, fakeReceiveSlots[5]),
    ];

    // cancel one of the active speaker requests
    mediaRequestManager.cancelRequest(requestIds[1], true);

    // expect only the 3 remaining requests to be sent out
    checkMediaRequestsSent([
      {policy: 'active-speaker', priority: 255, receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]]},
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[4]},
      {policy: 'receiver-selected', csi: 200, receiveSlot: fakeWcmeSlots[5]},
    ]);

    // cancel one of the receiver selected requests
    mediaRequestManager.cancelRequest(requestIds[3], true);

    // expect only the 2 remaining requests to be sent out
    checkMediaRequestsSent([
      {policy: 'active-speaker', priority: 255, receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]]},
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[4]},
    ]);
  });

  it('does not send out anything if addRequest() is called with commit=false', () => {
    addActiveSpeakerRequest(
      10,
      [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
      false
    );
    addReceiverSelectedRequest(123, fakeReceiveSlots[3], false);

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
      },
      {policy: 'receiver-selected', csi: 123, receiveSlot: fakeWcmeSlots[3]},
    ]);
  });

  it('does not send out anything if cancelRequest() is called with commit=false', () => {
    // send 4 requests
    const requestIds = [
      addActiveSpeakerRequest(
        250,
        [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
        false
      ),
      addReceiverSelectedRequest(98765, fakeReceiveSlots[3], false),
      addReceiverSelectedRequest(99999, fakeReceiveSlots[4], false),
      addReceiverSelectedRequest(88888, fakeReceiveSlots[5], true),
    ];

    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 250,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1], fakeWcmeSlots[2]],
      },
      {policy: 'receiver-selected', csi: 98765, receiveSlot: fakeWcmeSlots[3]},
      {policy: 'receiver-selected', csi: 99999, receiveSlot: fakeWcmeSlots[4]},
      {policy: 'receiver-selected', csi: 88888, receiveSlot: fakeWcmeSlots[5]},
    ]);

    // now cancel 3 of them, but with commit=false => nothing should happen
    mediaRequestManager.cancelRequest(requestIds[0], false);
    mediaRequestManager.cancelRequest(requestIds[2], false);
    mediaRequestManager.cancelRequest(requestIds[3], false);

    assert.notCalled(sendMediaRequestsCallback);

    // now do the commit
    mediaRequestManager.commit();

    checkMediaRequestsSent([
      {policy: 'receiver-selected', csi: 98765, receiveSlot: fakeWcmeSlots[3]},
    ]);
  });

  it('sends the wcme media requests when commit() is called', () => {
    // send some requests, all of them with commit=false
    addReceiverSelectedRequest(123000, fakeReceiveSlots[0], false);
    addReceiverSelectedRequest(456000, fakeReceiveSlots[1], false);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      false
    );

    // nothing should be sent out as we didn't commit the requests
    assert.notCalled(sendMediaRequestsCallback);

    // now do the commit
    mediaRequestManager.commit();

    // check that all requests have been sent out
    checkMediaRequestsSent([
      {policy: 'receiver-selected', csi: 123000, receiveSlot: fakeWcmeSlots[0]},
      {policy: 'receiver-selected', csi: 456000, receiveSlot: fakeWcmeSlots[1]},
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
      },
    ]);
  });

  it('clears all the requests on reset()', () => {
    // send some requests and commit them one by one
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], true);
    addReceiverSelectedRequest(1501, fakeReceiveSlots[1], true);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      true
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      true
    );

    sendMediaRequestsCallback.resetHistory();

    // check that when calling commit() all requests are re-sent again
    mediaRequestManager.commit();

    checkMediaRequestsSent([
      {policy: 'receiver-selected', csi: 1500, receiveSlot: fakeWcmeSlots[0]},
      {policy: 'receiver-selected', csi: 1501, receiveSlot: fakeWcmeSlots[1]},
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
      },
    ]);

    // now reset everything
    mediaRequestManager.reset();

    // calling commit now should not cause any requests to be sent out
    mediaRequestManager.commit();
    checkMediaRequestsSent([]);
  });

  it('calls resetSourceState() on slots that are stopped being used', () => {
    const requestIds = [
      addActiveSpeakerRequest(255, [fakeReceiveSlots[0], fakeReceiveSlots[1]]),
      addActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]]),
      addReceiverSelectedRequest(100, fakeReceiveSlots[4]),
      addReceiverSelectedRequest(200, fakeReceiveSlots[5]),
    ];

    mediaRequestManager.commit();
    checkMediaRequestsSent([
      {policy: 'active-speaker', priority: 255, receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]]},
      {policy: 'active-speaker', priority: 255, receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3]]},
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[4]},
      {policy: 'receiver-selected', csi: 200, receiveSlot: fakeWcmeSlots[5]},
    ]);

    // cancel 2 of the requests
    mediaRequestManager.cancelRequest(requestIds[1], false);
    mediaRequestManager.cancelRequest(requestIds[3], false);

    mediaRequestManager.commit();

    // expect only the 2 remaining requests to be sent out
    checkMediaRequestsSent([
      {policy: 'active-speaker', priority: 255, receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]]},
      {policy: 'receiver-selected', csi: 100, receiveSlot: fakeWcmeSlots[4]},
    ]);

    // and that the receive slots of the 2 cancelled ones had resetSourceState() called
    assert.calledOnce(fakeReceiveSlots[2].resetSourceState);
    assert.calledOnce(fakeReceiveSlots[3].resetSourceState);
    assert.calledOnce(fakeReceiveSlots[5].resetSourceState);
  });

  it('re-sends media requests after degradation preferences are set', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    assert.calledOnce(sendMediaRequestsCallback);
  });

  it('can degrade max-fs once when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});

    // request 5 "large" 1080p streams
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi: 123,
        },
        receiveSlots: fakeReceiveSlots.slice(0, 5),
        codecInfo: {
          maxFs: 8192,
        },
      },
      true
    );

    // check that resulting requests are 5 "medium" 720p streams
    assert.calledWith(sendMediaRequestsCallback, [
      sinon.match({
        policy: 'receiver-selected',
        policySpecificInfo: sinon.match({
          csi: 123,
        }),
        receiveSlots: fakeWcmeSlots.slice(0, 5),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 3600,
            }),
          }),
        ],
      }),
    ]);
  });

  it('can degrade max-fs multiple times when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});

    // request 10 "large" 1080p streams
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi: 123,
        },
        receiveSlots: fakeReceiveSlots.slice(0, 10),
        codecInfo: {
          maxFs: 8192,
        },
      },
      true
    );

    // check that resulting requests are 10 "small" 360p streams
    assert.calledWith(sendMediaRequestsCallback, [
      sinon.match({
        policy: 'receiver-selected',
        policySpecificInfo: sinon.match({
          csi: 123,
        }),
        receiveSlots: fakeWcmeSlots.slice(0, 10),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 920,
            }),
          }),
        ],
      }),
    ]);
  });

  it('can degrade only the largest max-fs when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});

    // request 5 "large" 1080p streams and 5 "small" 360p streams
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi: 123,
        },
        receiveSlots: fakeReceiveSlots.slice(0, 5),
        codecInfo: {
          maxFs: 8192,
        },
      },
      false
    );
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi: 456,
        },
        receiveSlots: fakeReceiveSlots.slice(5, 10),
        codecInfo: {
          maxFs: 920,
        },
      },
      true
    );

    // check that resulting requests are 5 "medium" 720p streams and 5 "small" 360p streams
    assert.calledWith(sendMediaRequestsCallback, [
      sinon.match({
        policy: 'receiver-selected',
        policySpecificInfo: sinon.match({
          csi: 123,
        }),
        receiveSlots: fakeWcmeSlots.slice(0, 5),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 3600,
            }),
          }),
        ],
      }),
      sinon.match({
        policy: 'receiver-selected',
        policySpecificInfo: sinon.match({
          csi: 456,
        }),
        receiveSlots: fakeWcmeSlots.slice(5, 10),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: 920,
            }),
          }),
        ],
      }),
    ]);
  });
});

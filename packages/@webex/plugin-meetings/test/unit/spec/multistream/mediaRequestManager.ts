import 'jsdom-global/register';
import MediaRequestManager from '@webex/plugin-meetings/src/multistream/mediaRequestManager';
import {ReceiveSlot} from '@webex/plugin-meetings/src/multistream/receiveSlot';
import type {SizeHint} from '@webex/plugin-meetings/src/multistream/types';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MediaCodecHelper from '@webex/plugin-meetings/src/multistream/codec/mediaCodecHelper';
import {getRecommendedMaxBitrateForFrameSize} from '@webex/internal-media-core';
import FakeTimers from '@sinonjs/fake-timers';
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import { expect } from 'chai';

type ExpectedActiveSpeaker = {
  policy: 'active-speaker';
  priority: number;
  receiveSlots: Array<ReceiveSlot>;
  sizeHint?: SizeHint;
  maxFs?: number;
  maxPayloadBitsPerSecond?: number;
  namedMediaGroups?:[{type: number, value: number}];
};
type ExpectedReceiverSelected = {
  policy: 'receiver-selected';
  csi: number;
  receiveSlot: ReceiveSlot;
  sizeHint?: SizeHint;
  maxFs?: number;
  maxPayloadBitsPerSecond?: number;
};
type ExpectedRequest = ExpectedActiveSpeaker | ExpectedReceiverSelected;

const degradationPreferences = {
  maxMacroblocksLimit: Infinity, // no limit
};

const resolveExpectedMaxFs = (req: ExpectedRequest): number | undefined => {
  if (req.maxFs !== undefined) return req.maxFs;
  if (req.sizeHint) return MediaCodecHelper.H264.getSizeHintMaxFs(req.sizeHint);
  return undefined;
};

const resolveExpectedBitrate = (req: ExpectedRequest): number | undefined => {
  if (req.maxPayloadBitsPerSecond !== undefined) return req.maxPayloadBitsPerSecond;
  const maxFs = resolveExpectedMaxFs(req);
  return maxFs ? getRecommendedMaxBitrateForFrameSize(maxFs) : undefined;
};

describe('MediaRequestManager', () => {
  const CROSS_PRIORITY_DUPLICATION = true;
  const CROSS_POLICY_DUPLICATION = true;

  const SIZE_HINT_SMALL: SizeHint = {resolution: 'small'};
  const SIZE_HINT_MEDIUM: SizeHint = {resolution: 'medium'};
  const SIZE_HINT_LARGE: SizeHint = {resolution: 'large'};
  const SIZE_HINT_540p: SizeHint = {width: 960, height: 540};

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
            setSizeHint: sinon.stub(),
            sourceState: 'live',
            wcmeReceiveSlot: fakeWcmeSlots[index],
          } as unknown as ReceiveSlot)
      );
  });

  // helper function for adding an active speaker request
  const addActiveSpeakerRequest = (
    priority,
    receiveSlots,
    sizeHint: SizeHint,
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
        sizeHint,
      },
      commit
    );

  // helper function for adding a receiver selected request
  const addReceiverSelectedRequest = (csi, receiveSlot, sizeHint: SizeHint, commit = false) =>
    mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi,
        },
        receiveSlots: [receiveSlot],
        sizeHint,
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
        const maxFs = resolveExpectedMaxFs(expectedRequest);
        const maxPayloadBitsPerSecond = resolveExpectedBitrate(expectedRequest);

        const codecInfosMatcher = isCodecInfoDefined && maxFs !== undefined
          ? [sinon.match({
              payloadType: 0x80,
              h264: sinon.match({maxFs}),
            })]
          : [];

        if (expectedRequest.policy === 'active-speaker') {
          const policyMatch: Record<string, unknown> = {
            priority: expectedRequest.priority,
            crossPriorityDuplication: CROSS_PRIORITY_DUPLICATION,
            crossPolicyDuplication: CROSS_POLICY_DUPLICATION,
            preferLiveVideo,
          };

          if (expectedRequest.namedMediaGroups) {
            policyMatch.namedMediaGroups = sinon.match(
              expectedRequest.namedMediaGroups.map((nmg) => sinon.match(nmg))
            );
          }

          const match: Record<string, unknown> = {
            policy: 'active-speaker',
            policySpecificInfo: sinon.match(policyMatch),
            receiveSlots: expectedRequest.receiveSlots,
            codecInfos: codecInfosMatcher,
          };

          if (maxPayloadBitsPerSecond !== undefined) {
            match.maxPayloadBitsPerSecond = maxPayloadBitsPerSecond;
          }

          return sinon.match(match);
        }
        if (expectedRequest.policy === 'receiver-selected') {
          const match: Record<string, unknown> = {
            policy: 'receiver-selected',
            policySpecificInfo: sinon.match({
              csi: expectedRequest.csi,
            }),
            receiveSlots: [expectedRequest.receiveSlot],
            codecInfos: codecInfosMatcher,
          };

          if (maxPayloadBitsPerSecond !== undefined) {
            match.maxPayloadBitsPerSecond = maxPayloadBitsPerSecond;
          }

          return sinon.match(match);
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
        sizeHint: SIZE_HINT_SMALL,
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
        sizeHint: SIZE_HINT_MEDIUM,
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
        sizeHint: SIZE_HINT_LARGE,
      },
      true
    );

    const expectedSmallMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs(SIZE_HINT_SMALL);
    const expectedMediumMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs(SIZE_HINT_MEDIUM);
    const expectedLargeMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs(SIZE_HINT_LARGE);

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
        maxPayloadBitsPerSecond: getRecommendedMaxBitrateForFrameSize(expectedSmallMaxFs),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: expectedSmallMaxFs,
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
        maxPayloadBitsPerSecond: getRecommendedMaxBitrateForFrameSize(expectedMediumMaxFs),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: expectedMediumMaxFs,
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
        maxPayloadBitsPerSecond: getRecommendedMaxBitrateForFrameSize(expectedLargeMaxFs),
        codecInfos: [
          sinon.match({
            payloadType: 0x80,
            h264: sinon.match({
              maxFs: expectedLargeMaxFs,
            }),
          }),
        ],
      }),
    ]);
  });

  it('keeps adding requests with every call to addRequest()', () => {
    // start with 1 request
    addReceiverSelectedRequest(100, fakeReceiveSlots[0], SIZE_HINT_LARGE, true);

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);

    // now add another one
    addReceiverSelectedRequest(101, fakeReceiveSlots[1], SIZE_HINT_LARGE, true);

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 101,
        receiveSlot: fakeWcmeSlots[1],
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);

    // and one more
    addActiveSpeakerRequest(
      1,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      SIZE_HINT_MEDIUM,
      true
    );

    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[0],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 101,
        receiveSlot: fakeWcmeSlots[1],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'active-speaker',
        priority: 1,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        sizeHint: SIZE_HINT_MEDIUM,
      },
    ]);
  });

  it('removes sourceUpdate, maxFsUpdate, and sizeHintUpdate when cancelRequest() is called', () => {
    const requestId = addActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]], SIZE_HINT_MEDIUM);

    mediaRequestManager.cancelRequest(requestId, true);

    const offCalls = fakeReceiveSlots[2].off.getCalls();
    const offFor = (event: string) => offCalls.find((c) => c.args[0] === event);

    ['sourceUpdate', 'maxFsUpdate', 'sizeHintUpdate'].forEach((event) => {
      const call = offFor(event);

      assert.isDefined(call, `expected off() for ${event}`);
      expect(call.args[1]).to.be.a('function');
    });
  });

  it('cancels the requests correctly when cancelRequest() is called with commit=true', () => {
    const requestIds = [
      addActiveSpeakerRequest(255, [fakeReceiveSlots[0], fakeReceiveSlots[1]], SIZE_HINT_MEDIUM),
      addActiveSpeakerRequest(255, [fakeReceiveSlots[2], fakeReceiveSlots[3]], SIZE_HINT_MEDIUM),
      addReceiverSelectedRequest(100, fakeReceiveSlots[4], SIZE_HINT_LARGE),
      addReceiverSelectedRequest(200, fakeReceiveSlots[5], SIZE_HINT_LARGE),
    ];

    // cancel one of the active speaker requests
    mediaRequestManager.cancelRequest(requestIds[1], true);

    // expect only the 3 remaining requests to be sent out
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1]],
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[4],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 200,
        receiveSlot: fakeWcmeSlots[5],
        sizeHint: SIZE_HINT_LARGE,
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
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'receiver-selected',
        csi: 100,
        receiveSlot: fakeWcmeSlots[4],
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);
  });

  it('does not send out anything if addRequest() is called with commit=false', () => {
    addActiveSpeakerRequest(
      10,
      [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
      SIZE_HINT_MEDIUM,
      false
    );
    addReceiverSelectedRequest(123, fakeReceiveSlots[3], SIZE_HINT_LARGE, false);

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
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'receiver-selected',
        csi: 123,
        receiveSlot: fakeWcmeSlots[3],
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);
  });

  it('does not send out anything if cancelRequest() is called with commit=false', () => {
    // send 4 requests
    const requestIds = [
      addActiveSpeakerRequest(
        250,
        [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
        SIZE_HINT_MEDIUM,
        false
      ),
      addReceiverSelectedRequest(98765, fakeReceiveSlots[3], SIZE_HINT_LARGE, false),
      addReceiverSelectedRequest(99999, fakeReceiveSlots[4], SIZE_HINT_LARGE, false),
      addReceiverSelectedRequest(88888, fakeReceiveSlots[5], SIZE_HINT_LARGE, true),
    ];

    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 250,
        receiveSlots: [fakeWcmeSlots[0], fakeWcmeSlots[1], fakeWcmeSlots[2]],
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'receiver-selected',
        csi: 98765,
        receiveSlot: fakeWcmeSlots[3],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 99999,
        receiveSlot: fakeWcmeSlots[4],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 88888,
        receiveSlot: fakeWcmeSlots[5],
        sizeHint: SIZE_HINT_LARGE,
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
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);
  });

  it('sends the wcme media requests when commit() is called', () => {
    // send some requests, all of them with commit=false
    addReceiverSelectedRequest(123000, fakeReceiveSlots[0], SIZE_HINT_LARGE, false);
    addReceiverSelectedRequest(456000, fakeReceiveSlots[1], SIZE_HINT_LARGE, false);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      SIZE_HINT_MEDIUM,
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      SIZE_HINT_MEDIUM,
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[8], fakeReceiveSlots[9], fakeReceiveSlots[10]],
      SIZE_HINT_MEDIUM,
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
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 456000,
        receiveSlot: fakeWcmeSlots[1],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[8], fakeWcmeSlots[9], fakeWcmeSlots[10]],
        sizeHint: SIZE_HINT_MEDIUM,
        namedMediaGroups: [{type: 1, value: 20}],
      },
    ]);
  });

  it('avoids sending duplicate requests and clears all the requests on reset()', () => {
    // send some requests and commit them one by one
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], SIZE_HINT_LARGE, false);
    addReceiverSelectedRequest(1501, fakeReceiveSlots[1], SIZE_HINT_LARGE, false);
    addActiveSpeakerRequest(
      255,
      [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      SIZE_HINT_MEDIUM,
      false
    );
    addActiveSpeakerRequest(
      254,
      [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      SIZE_HINT_MEDIUM,
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
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'receiver-selected',
        csi: 1501,
        receiveSlot: fakeWcmeSlots[1],
        sizeHint: SIZE_HINT_LARGE,
      },
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: [fakeWcmeSlots[2], fakeWcmeSlots[3], fakeWcmeSlots[4]],
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: [fakeWcmeSlots[5], fakeWcmeSlots[6], fakeWcmeSlots[7]],
        sizeHint: SIZE_HINT_MEDIUM,
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
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], SIZE_HINT_LARGE, false);

    assert.notCalled(sendMediaRequestsCallback);

    mediaRequestManager.commit();
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1500,
        receiveSlot: fakeWcmeSlots[0],
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);

    // now reset everything
    mediaRequestManager.reset();

    // calling commit now should not cause any requests to be sent out
    mediaRequestManager.commit();
    checkMediaRequestsSent([]);

    //add new request
    addReceiverSelectedRequest(1501, fakeReceiveSlots[1], SIZE_HINT_LARGE, false);

    // commit
    mediaRequestManager.commit();

    // check the new request was sent
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1501,
        receiveSlot: fakeWcmeSlots[1],
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);
  });

  it('can send same media request after previous requests have been cleared', () => {
    // add a request and commit
    addReceiverSelectedRequest(1500, fakeReceiveSlots[0], SIZE_HINT_LARGE, false);
    mediaRequestManager.commit();
    checkMediaRequestsSent([
      {
        policy: 'receiver-selected',
        csi: 1500,
        receiveSlot: fakeWcmeSlots[0],
        sizeHint: SIZE_HINT_LARGE,
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
        receiveSlot: fakeWcmeSlots[0],
        sizeHint: SIZE_HINT_LARGE,
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

    // request 4 "large" streams, which should degrade to "medium" if live
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 4), SIZE_HINT_LARGE, true);

    // check that resulting requests remain "large" (no degradation because sources are not live)
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 4),
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);
  });

  it('can degrade max-fs once when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 3 "large" streams
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 3), SIZE_HINT_LARGE, false);

    // request additional "large" stream to exceed max macroblocks limit
    const additionalRequestId = addReceiverSelectedRequest(
      123,
      fakeReceiveSlots[3],
      SIZE_HINT_LARGE,
      true
    );

    // check that resulting requests are degraded to "medium"
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 3),
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'receiver-selected',
        csi: 123,
        receiveSlot: fakeWcmeSlots[3],
        sizeHint: SIZE_HINT_MEDIUM,
      },
    ]);

    // cancel additional request
    mediaRequestManager.cancelRequest(additionalRequestId);

    // check that resulting requests bounce back to "large"
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 3),
        sizeHint: SIZE_HINT_LARGE,
      },
    ]);
  });

  it('can degrade max-fs multiple times when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 10 "large" streams
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 10), SIZE_HINT_LARGE, true);

    // check that resulting requests are degraded to 540p
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 10),
        sizeHint: SIZE_HINT_540p,
      },
    ]);
  });

  it('can degrade only the largest max-fs when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 5 "large" streams and 5 "small" streams
    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 5), SIZE_HINT_LARGE, false);
    addActiveSpeakerRequest(254, fakeReceiveSlots.slice(5, 10), SIZE_HINT_SMALL, true);

    // check that only "large" streams are degraded to "medium", "small" stays unchanged
    checkMediaRequestsSent([
      {
        policy: 'active-speaker',
        priority: 255,
        receiveSlots: fakeWcmeSlots.slice(0, 5),
        sizeHint: SIZE_HINT_MEDIUM,
      },
      {
        policy: 'active-speaker',
        priority: 254,
        receiveSlots: fakeWcmeSlots.slice(5, 10),
        sizeHint: SIZE_HINT_SMALL,
      },
    ]);
  });

  it('respects the preferredMaxFs if set', () => {
    sendMediaRequestsCallback.resetHistory();
    const clock = FakeTimers.install({now: Date.now()});

    addActiveSpeakerRequest(255, fakeReceiveSlots.slice(0, 10), SIZE_HINT_LARGE, true);

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
          sizeHint: SIZE_HINT_LARGE,
        },
        false
      );

      mediaRequestManager.commit();

      checkMediaRequestsSent([
        {
          policy: 'receiver-selected',
          csi: 123,
          receiveSlot: fakeWcmeSlots[0],
          sizeHint: SIZE_HINT_LARGE,
        },
      ]);

      // calls the utility function as expected with maxFs passed in (no need to do
      // further tests here, since the util function itself should be tested for different inputs)
      const expectedMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs(SIZE_HINT_LARGE);
      assert.calledWith(getRecommendedMaxBitrateForFrameSizeSpy, expectedMaxFs);
    });
  });

  describe('codec info', () => {
    beforeEach(() => {
      sendMediaRequestsCallback.resetHistory();
    });

    it('includes codec info matching the requested size hint', () => {
      mediaRequestManager.addRequest(
        {
          policyInfo: {
            policy: 'receiver-selected',
            csi: 123,
          },
          receiveSlots: [fakeReceiveSlots[0]],
          sizeHint: SIZE_HINT_LARGE,
        },
        false
      );

      mediaRequestManager.commit();

      checkMediaRequestsSent([
        {
          policy: 'receiver-selected',
          csi: 123,
          receiveSlot: fakeWcmeSlots[0],
          sizeHint: SIZE_HINT_LARGE,
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
          addReceiverSelectedRequest(100, fakeReceiveSlots[0], SIZE_HINT_SMALL, false);
          addActiveSpeakerRequest( // AS request 1 - it will get 1 slot trimmed
            254,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            SIZE_HINT_SMALL,
            false,
            preferLiveVideo
          );
          addActiveSpeakerRequest( // AS request 2 - lowest priority, it will have all slots trimmed
            253,
            [fakeReceiveSlots[7], fakeReceiveSlots[8], fakeReceiveSlots[9]],
            SIZE_HINT_SMALL,
            false,
            preferLiveVideo
          );
          addActiveSpeakerRequest( // AS request 3 - highest priority, nothing will be trimmed
            255,
            [fakeReceiveSlots[4], fakeReceiveSlots[5], fakeReceiveSlots[6]],
            SIZE_HINT_SMALL,
            false,
            preferLiveVideo
          );
          addReceiverSelectedRequest(101, fakeReceiveSlots[10], SIZE_HINT_SMALL, false);

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
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'active-speaker',
              priority: 254,
              receiveSlots: [fakeWcmeSlots[1], fakeWcmeSlots[2]], // fakeWcmeSlots[3] got trimmed
              sizeHint: SIZE_HINT_SMALL,
            },
            // AS request with priority 253 is missing, because all of its slots got trimmed
            {
              policy: 'active-speaker',
              priority: 255,
              receiveSlots: [fakeWcmeSlots[4], fakeWcmeSlots[5], fakeWcmeSlots[6]],
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'receiver-selected',
              csi: 101,
              receiveSlot: fakeWcmeSlots[10],
              sizeHint: SIZE_HINT_SMALL,
            },
          ], {preferLiveVideo});

          // now increase the number of available streams so only the last AS request is trimmed by 1
          limitNumAvailableStreams(preferLiveVideo, 10);

          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 100,
              receiveSlot: fakeWcmeSlots[0],
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'active-speaker',
              priority: 254,
              receiveSlots: [fakeWcmeSlots[1], fakeWcmeSlots[2], fakeWcmeSlots[3]], // all slots are used, nothing trimmed
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'active-speaker',
              priority: 253,
              receiveSlots: [fakeWcmeSlots[7], fakeWcmeSlots[8]], // only 1 slot is trimmed
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'active-speaker',
              priority: 255,
              receiveSlots: [fakeWcmeSlots[4], fakeWcmeSlots[5], fakeWcmeSlots[6]], // all slots are used, nothing trimmed
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'receiver-selected',
              csi: 101,
              receiveSlot: fakeWcmeSlots[10],
              sizeHint: SIZE_HINT_SMALL,
            },
          ], {preferLiveVideo});
        })

        it('does not trim the receiver selected requests', async () => {
          // add some receiver-selected and active-speaker requests, in a mixed up order
          addReceiverSelectedRequest(200, fakeReceiveSlots[0], SIZE_HINT_SMALL, false);
          addActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            SIZE_HINT_SMALL,
            false,
            preferLiveVideo
          );
          addReceiverSelectedRequest(201, fakeReceiveSlots[4], SIZE_HINT_MEDIUM, false);
          addActiveSpeakerRequest(
            254,
            [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
            SIZE_HINT_MEDIUM,
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
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'receiver-selected',
              csi: 201,
              receiveSlot: fakeWcmeSlots[4],
              sizeHint: SIZE_HINT_MEDIUM,
            },
          ], {preferLiveVideo});
        });

        it('does trimming first and applies degradationPreferences after that', async () => {
          // add some receiver-selected and active-speaker requests
          addReceiverSelectedRequest(200, fakeReceiveSlots[0], SIZE_HINT_SMALL, false);
          addActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            SIZE_HINT_SMALL,
            false,
            preferLiveVideo
          );
          addReceiverSelectedRequest(201, fakeReceiveSlots[4], SIZE_HINT_MEDIUM, false);
          addActiveSpeakerRequest(
            254,
            [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
            SIZE_HINT_MEDIUM,
            false,
            preferLiveVideo
          );

          const smallMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs(SIZE_HINT_SMALL);
          const mediumMaxFs = MediaCodecHelper.H264.getSizeHintMaxFs(SIZE_HINT_MEDIUM);

          // Set maxMacroblocksLimit to a value that's big enough just for the 2 RS requests and 1 AS with 1 slot of "small".
          // but not big enough for all of the RS and AS requests. If maxMacroblocksLimit
          // was applied first, the resolution of all requests (including RS ones) would be degraded
          // This test verifies that it's not happening and the resolutions are not affected.
          mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: smallMaxFs + mediumMaxFs + smallMaxFs});
          sendMediaRequestsCallback.resetHistory();

          /* Limit the num of streams so that only 2 RS requests and 1 AS with 1 slot can be sent out */
          limitNumAvailableStreams(preferLiveVideo, 3);

          // check what got trimmed - the remaining requests should have unchanged resolutions
          checkMediaRequestsSent([
            {
              policy: 'receiver-selected',
              csi: 200,
              receiveSlot: fakeWcmeSlots[0],
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'active-speaker',
              priority: 255,
              receiveSlots: [fakeWcmeSlots[1]],
              sizeHint: SIZE_HINT_SMALL,
            },
            {
              policy: 'receiver-selected',
              csi: 201,
              receiveSlot: fakeWcmeSlots[4],
              sizeHint: SIZE_HINT_MEDIUM,
            },
          ], {preferLiveVideo});
        });

        it('trims all AS requests completely until setNumCurrentSources() is called with non-zero values', async () => {
          // add some receiver-selected and active-speaker requests
          addReceiverSelectedRequest(200, fakeReceiveSlots[0], SIZE_HINT_SMALL, false);
          addActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            SIZE_HINT_SMALL,
            false,
            preferLiveVideo
          );
          addActiveSpeakerRequest(
            254,
            [fakeReceiveSlots[5]],
            SIZE_HINT_SMALL,
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
              sizeHint: SIZE_HINT_SMALL,
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
          addReceiverSelectedRequest(200, fakeReceiveSlots[0], SIZE_HINT_SMALL, false);
          addActiveSpeakerRequest(
            255,
            [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            SIZE_HINT_SMALL,
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
              sizeHint: SIZE_HINT_SMALL,
            },
          ], {preferLiveVideo});
        });
      })
    );


    it('throws if there are 2 active-speaker requests with different preferLiveVideo values', () => {
      addActiveSpeakerRequest(
        255,
        [fakeReceiveSlots[0]],
        SIZE_HINT_SMALL,
        false,
        true
      );
      addReceiverSelectedRequest(201, fakeReceiveSlots[4], SIZE_HINT_MEDIUM, false);
      addActiveSpeakerRequest(
        254,
        [fakeReceiveSlots[2]],
        SIZE_HINT_SMALL,
        false,
        false
      );

      assert.throws(() => mediaRequestManager.commit(), 'a mix of active-speaker groups with different values for preferLiveVideo is not supported');
    })
  })
});

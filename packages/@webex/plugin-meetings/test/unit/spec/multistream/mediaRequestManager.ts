import 'jsdom-global/register';
import {MediaRequest, MediaRequestManager} from '../../../../src/multistream/mediaRequestManager';
import {ReceiveSlot} from '../../../../src/multistream/receiveSlot';
import sinon from 'sinon';
import {AV1_CODEC_PARAMETERS, CODEC_DEFAULTS, H264_CODEC_PARAMETERS} from '../../../../src/multistream/codec/constants';
import {SupportedResolution} from '../../../../src/multistream/codec/types';
import {ActiveSpeakerInfo, CodecInfo, getRecommendedMaxBitrateForFrameSize, getRecommendedMaxBitrateForPicSize, H264Codec, Policy, PolicySpecificInfo, ReceiverSelectedInfo, StreamRequest} from '@webex/internal-media-core';
import MediaCodecHelper from '../../../../src/multistream/codec/mediaCodecHelper';
import { assert, expect } from '@webex/test-helper-chai';
import FakeTimers from '@sinonjs/fake-timers';

const SLOTS_COUNT = 15;

describe('MediaRequestManager', () => {
  let mediaRequestManager: MediaRequestManager;
  let sendMediaRequestsCallback;
  let fakeWcmeSlots;
  let fakeReceiveSlots;

  beforeEach(() => {
    sendMediaRequestsCallback = sinon.stub();
    mediaRequestManager = new MediaRequestManager(sendMediaRequestsCallback, {
      degradationPreferences: {
        maxMacroblocksLimit: Infinity, // no limit
      },
      kind: 'video',
      trimRequestsToNumOfSources: false,
    });

    // create some fake receive slots used by the tests
    fakeWcmeSlots = Array(SLOTS_COUNT)
      .fill(null)
      .map((_, index) => ({
        id: `fake WCME slot ${index}`,
      }));

    fakeReceiveSlots = Array(SLOTS_COUNT)
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

  const DEFAULT_MEDIA_REQUEST = {
    ACTIVE_SPEAKER: {
      policyInfo: {
        policy: 'active-speaker' as const,
        priority: 1,
        crossPriorityDuplication: true,
        crossPolicyDuplication: true,
        preferLiveVideo: true,
        namedMediaGroups: undefined,
      },
    },
    RECEIVER_SELECTED: {
      policyInfo: {
        policy: 'receiver-selected' as const,
        csi: 123,
      },
    },
  };

  const RequestHelper = {
    H264: {
      activeSpeaker: (
        resolution: SupportedResolution = '1080p',
        override?: Partial<MediaRequest>
      ): MediaRequest => {
        const baseRequest = {
          ...DEFAULT_MEDIA_REQUEST.ACTIVE_SPEAKER,
          receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
          codecInfo: {
            codec: 'h264' as const,
            ...CODEC_DEFAULTS.h264,
            ...H264_CODEC_PARAMETERS[resolution],
          },
        };

        if (!override) {
          return baseRequest;
        }

        return {
          ...baseRequest,
          ...override,
          policyInfo: {
            ...baseRequest.policyInfo,
            ...override.policyInfo,
          } as any,
          codecInfo: {
            ...baseRequest.codecInfo,
            ...override.codecInfo,
          },
        };
      },
      receiverSelected: (
        resolution: SupportedResolution = '1080p',
        override?: Partial<MediaRequest>
      ): MediaRequest => {
        const baseRequest = {
          ...DEFAULT_MEDIA_REQUEST.RECEIVER_SELECTED,
          receiveSlots: [fakeReceiveSlots[3]],
          codecInfo: {
            codec: 'h264' as const,
            ...CODEC_DEFAULTS.h264,
            ...H264_CODEC_PARAMETERS[resolution],
          },
        };

        if (!override) {
          return baseRequest;
        }

        return {
          ...baseRequest,
          ...override,
          policyInfo: {
            ...baseRequest.policyInfo,
            ...override.policyInfo,
          } as any,
          codecInfo: {
            ...baseRequest.codecInfo,
            ...override.codecInfo,
          },
        };
      },
    },
    AV1: {
      activeSpeaker: (
        resolution: SupportedResolution = '1080p',
        override?: Partial<MediaRequest>
      ): MediaRequest => {
        const baseRequest = {
          ...DEFAULT_MEDIA_REQUEST.ACTIVE_SPEAKER,
          receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
          codecInfo: {
            codec: 'av1' as const,
            ...CODEC_DEFAULTS.av1,
            ...AV1_CODEC_PARAMETERS[resolution],
          },
        };

        if (!override) {
          return baseRequest;
        }

        return {
          ...baseRequest,
          ...override,
          policyInfo: {
            ...baseRequest.policyInfo,
            ...override.policyInfo,
          } as any,
          codecInfo: {
            ...baseRequest.codecInfo,
            ...override.codecInfo,
          },
        };
      },
      receiverSelected: (
        resolution: SupportedResolution = '1080p',
        override?: Partial<MediaRequest>
      ): MediaRequest => {
        const baseRequest = {
          ...DEFAULT_MEDIA_REQUEST.RECEIVER_SELECTED,
          receiveSlots: [fakeReceiveSlots[3]],
          codecInfo: {
            codec: 'av1' as const,
            ...CODEC_DEFAULTS.av1,
            ...AV1_CODEC_PARAMETERS[resolution],
          },
        };

        if (!override) {
          return baseRequest;
        }

        return {
          ...baseRequest,
          ...override,
          policyInfo: {
            ...baseRequest.policyInfo,
            ...override.policyInfo,
          } as any,
          codecInfo: {
            ...baseRequest.codecInfo,
            ...override.codecInfo,
          },
        };
      },
    }
  };

  const checkMediaRequestsSent = (requests: MediaRequest[]) => {
    sinon.assert.calledWith(
      sendMediaRequestsCallback,
      requests.map((request) => {
        const receiveSlots = request.receiveSlots.map((slot) => slot.wcmeReceiveSlot);

        // policy
        let policy: Policy;
        let policySpecificInfo: PolicySpecificInfo;
        if (request.policyInfo.policy === 'active-speaker') {
          policy = Policy.ActiveSpeaker;
          policySpecificInfo = new ActiveSpeakerInfo(
            request.policyInfo.priority,
            request.policyInfo.crossPriorityDuplication,
            request.policyInfo.crossPolicyDuplication,
            request.policyInfo.preferLiveVideo,
            request.policyInfo.namedMediaGroups,
          );
        }
        if (request.policyInfo.policy === 'receiver-selected') {
          policy = Policy.ReceiverSelected;
          policySpecificInfo = new ReceiverSelectedInfo(request.policyInfo.csi);
        }

        // codec info
        let maxPayloadBitsPerSecond: number;
        let codecInfos: CodecInfo[];
        if (request.codecInfo.codec === 'h264') {
          maxPayloadBitsPerSecond = MediaCodecHelper.H264.getMaxPayloadBitsPerSecond(request);
          codecInfos = MediaCodecHelper.H264.getWCMECodecInfos(request);
        }
        if (request.codecInfo.codec === 'av1') {
          maxPayloadBitsPerSecond = MediaCodecHelper.AV1.getMaxPayloadBitsPerSecond(request);
          codecInfos = MediaCodecHelper.AV1.getWCMECodecInfos(request);
        }

        return new StreamRequest(
          policy,
          policySpecificInfo,
          receiveSlots,
          maxPayloadBitsPerSecond,
          codecInfos,
        );
      })
    );
  };

  it('starts with no requests', () => {
    mediaRequestManager.commit();

    sinon.assert.calledOnce(sendMediaRequestsCallback);
    sinon.assert.calledWith(sendMediaRequestsCallback, []);
  });

  it('sends correct wcme media requests when addRequest() is called with commit=true', () => {
    const request1 = RequestHelper.H264.activeSpeaker('1080p');
    const request2 = RequestHelper.H264.receiverSelected('1080p');
    const request3 = RequestHelper.H264.receiverSelected('720p');

    mediaRequestManager.addRequest(request1, false);
    mediaRequestManager.addRequest(request2, false);
    mediaRequestManager.addRequest(request3, true);

    sinon.assert.calledOnce(sendMediaRequestsCallback);
    checkMediaRequestsSent([request1, request2, request3]);
  });

  it('sends correct wcme media requests for AV1 when addRequest() is called with commit=true', () => {
    const request1 = RequestHelper.AV1.activeSpeaker('1080p');
    const request2 = RequestHelper.AV1.receiverSelected('1080p');
    const request3 = RequestHelper.AV1.receiverSelected('720p');

    mediaRequestManager.addRequest(request1, false);
    mediaRequestManager.addRequest(request2, false);
    mediaRequestManager.addRequest(request3, true);

    sinon.assert.calledOnce(sendMediaRequestsCallback);
    checkMediaRequestsSent([request1, request2, request3]);
  });

  it('keeps adding requests with every call to addRequest()', () => {
    // start with 1 request
    const request1 = RequestHelper.H264.receiverSelected('1080p');
    mediaRequestManager.addRequest(request1, true);
    checkMediaRequestsSent([request1]);

    // now add another one
    const request2 = RequestHelper.H264.receiverSelected('720p');
    mediaRequestManager.addRequest(request2, true);
    checkMediaRequestsSent([request1, request2]);

    // and one more
    const request3 = RequestHelper.H264.receiverSelected('540p');
    mediaRequestManager.addRequest(request3, true);
    checkMediaRequestsSent([request1, request2, request3]);
  })

  it('removes the events maxFsUpdate and sourceUpdate when cancelRequest() is called', async () => {
    const request1 = RequestHelper.H264.receiverSelected('1080p');
    const request1Id = mediaRequestManager.addRequest(request1, true);
    mediaRequestManager.cancelRequest(request1Id, true);

    const sourceUpdateHandler = fakeReceiveSlots[3].off.getCall(0);
    const maxFsHandlerCall = fakeReceiveSlots[3].off.getCall(1);

    const sourceUpdateEventName = sourceUpdateHandler.args[0];
    const maxFsEventName = maxFsHandlerCall.args[0];

    expect(sourceUpdateHandler.args[1]).to.be.a('function');
    expect(maxFsHandlerCall.args[1]).to.be.a('function');

    assert.equal(maxFsEventName, 'maxFsUpdate')
    assert.equal(sourceUpdateEventName, 'sourceUpdate')
  })

  it('cancels the requests correctly when cancelRequest() is called with commit=true', () => {
    const request1 = RequestHelper.H264.activeSpeaker('1080p');
    const request2 = RequestHelper.H264.activeSpeaker('720p');
    const request3 = RequestHelper.H264.receiverSelected('540p');
    const request4 = RequestHelper.H264.receiverSelected('360p');

    const requestIds = [
      mediaRequestManager.addRequest(request1, false),
      mediaRequestManager.addRequest(request2, false),
      mediaRequestManager.addRequest(request3, false),
      mediaRequestManager.addRequest(request4, false),
    ]

    mediaRequestManager.cancelRequest(requestIds[1], true);
    checkMediaRequestsSent([request1, request3, request4]);

    mediaRequestManager.cancelRequest(requestIds[2], true);
    checkMediaRequestsSent([request1, request4]);
  })

  it('does not send out anything if addRequest() is called with commit=false', () => {
    const request1 = RequestHelper.H264.activeSpeaker('1080p');
    const request2 = RequestHelper.H264.receiverSelected('1080p');
    const request3 = RequestHelper.H264.receiverSelected('720p');

    mediaRequestManager.addRequest(request1, false);
    mediaRequestManager.addRequest(request2, false);
    mediaRequestManager.addRequest(request3, false);

    sinon.assert.notCalled(sendMediaRequestsCallback);

    mediaRequestManager.commit();
    checkMediaRequestsSent([request1, request2, request3]);
  })

  it('does not send out anything if cancelRequest() is called with commit=false', () => {
    const request1 = RequestHelper.H264.activeSpeaker('1080p');
    const request2 = RequestHelper.H264.receiverSelected('1080p');
    const request3 = RequestHelper.H264.receiverSelected('720p');

    const requestIds = [
      mediaRequestManager.addRequest(request1, false),
      mediaRequestManager.addRequest(request2, false),
      mediaRequestManager.addRequest(request3, false),
    ]

    mediaRequestManager.cancelRequest(requestIds[1], false);
    mediaRequestManager.cancelRequest(requestIds[2], false);

    sinon.assert.notCalled(sendMediaRequestsCallback);

    mediaRequestManager.commit();
    checkMediaRequestsSent([request1]);
  })

  it('makes sure to call requests correctly after reset was called and another request was added', () => {
    const request1 = RequestHelper.H264.receiverSelected('1080p');
    mediaRequestManager.addRequest(request1, true);
    checkMediaRequestsSent([request1]);

    mediaRequestManager.reset();
    mediaRequestManager.commit();
    checkMediaRequestsSent([]);
  })

  it('re-sends media requests after degradation preferences are set', () => {
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sinon.assert.calledOnce(sendMediaRequestsCallback);
  })

  it('should not degrade if receive slot sources are not live', () => {
    // set receive slot source states to "no source"
    fakeReceiveSlots.forEach((slot) => {
      slot.sourceState = 'no source';
    });

    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 4 "large" 1080p streams, which should degrade to 720p if live
    const request1 = RequestHelper.H264.activeSpeaker('1080p', {
      receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
    });
    mediaRequestManager.addRequest(request1, true);

    // check that resulting requests are 4 "large" 1080p streams
    checkMediaRequestsSent([request1]);
  })

  it('should not degrade AV1 if receive slot sources are not live', () => {
    // set receive slot source states to "no source"
    fakeReceiveSlots.forEach((slot) => {
      slot.sourceState = 'no source';
    });

    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 4 "large" 1080p streams, which should degrade to 720p if live
    const request1 = RequestHelper.AV1.activeSpeaker('1080p', {
      receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
    });
    mediaRequestManager.addRequest(request1, true);

    // check that resulting requests are 4 "large" 1080p streams
    checkMediaRequestsSent([request1]);

    // reset source state back to live for subsequent tests
    fakeReceiveSlots.forEach((slot) => {
      slot.sourceState = 'live';
    });
  })

  it('should degrade H264 once when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 3 "large" 1080p streams
    const request1 = RequestHelper.H264.activeSpeaker('1080p', {
      receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
    });
    mediaRequestManager.addRequest(request1, true);

    // request additional "large" 1080p stream to exceed max macroblocks limit
    const request2 = RequestHelper.H264.receiverSelected('1080p', {
      receiveSlots: [fakeReceiveSlots[3]],
    });
    const request2Id = mediaRequestManager.addRequest(request2, true);

    // check that resulting requests are 4 "medium" 720p streams
    const request1Degraded = {
      ...request1,
      codecInfo: {
        ...request1.codecInfo,
        ...H264_CODEC_PARAMETERS['720p'],
      },
    }
    const request2Degraded = {
      ...request2,
      codecInfo: {
        ...request2.codecInfo,
        ...H264_CODEC_PARAMETERS['720p'],
      },
    }
    checkMediaRequestsSent([request1Degraded, request2Degraded]);

    // cancel additional request
    mediaRequestManager.cancelRequest(request2Id);

    // check that resulting requests are 3 "large" 1080p streams
    checkMediaRequestsSent([request1]);
  })

  it('should degrade AV1 once when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 3 "large" 1080p streams
    const request1 = RequestHelper.AV1.activeSpeaker('1080p', {
      receiveSlots: [fakeReceiveSlots[0], fakeReceiveSlots[1], fakeReceiveSlots[2]],
    });
    mediaRequestManager.addRequest(request1, true);

    // request additional "large" 1080p stream to exceed max macroblocks limit
    const request2 = RequestHelper.AV1.receiverSelected('1080p', {
      receiveSlots: [fakeReceiveSlots[3]],
    });
    const request2Id = mediaRequestManager.addRequest(request2, true);

    // check that resulting requests are 4 "medium" 720p streams
    // Note: only maxPicSize gets degraded, other parameters stay the same
    const request1Degraded = {
      ...request1,
      codecInfo: {
        ...request1.codecInfo,
        maxPicSize: AV1_CODEC_PARAMETERS['720p'].maxPicSize,
      },
    }
    const request2Degraded = {
      ...request2,
      codecInfo: {
        ...request2.codecInfo,
        maxPicSize: AV1_CODEC_PARAMETERS['720p'].maxPicSize,
      },
    }
    checkMediaRequestsSent([request1Degraded, request2Degraded]);

    // cancel additional request
    mediaRequestManager.cancelRequest(request2Id);

    // check that resulting requests are 3 "large" 1080p streams
    checkMediaRequestsSent([request1]);
  })

  it('can degrade max-fs multiple times when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 10 "large" 1080p streams
    const request1 = RequestHelper.H264.activeSpeaker('1080p', {
      receiveSlots: fakeReceiveSlots.slice(0, 10),
    });
    mediaRequestManager.addRequest(request1, true);

    // check that resulting requests are 10 540p streams
    const request1Degraded = {
      ...request1,
      codecInfo: {
        ...request1.codecInfo,
        ...H264_CODEC_PARAMETERS['540p'],
      },
    }
    checkMediaRequestsSent([request1Degraded]);
  })

  it('can degrade AV1 max-pic-size multiple times when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 10 "large" 1080p streams
    const request1 = RequestHelper.AV1.activeSpeaker('1080p', {
      receiveSlots: fakeReceiveSlots.slice(0, 10),
    });
    mediaRequestManager.addRequest(request1, true);

    // check that resulting requests are 10 540p streams
    // Note: only maxPicSize gets degraded, other parameters stay the same
    const request1Degraded = {
      ...request1,
      codecInfo: {
        ...request1.codecInfo,
        maxPicSize: AV1_CODEC_PARAMETERS['540p'].maxPicSize,
      },
    }
    checkMediaRequestsSent([request1Degraded]);
  })

  it('can degrade only the largest max-fs when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 5 "large" 1080p streams and 5 "small" 360p streams
    const request1 = RequestHelper.H264.activeSpeaker('1080p', {
      receiveSlots: fakeReceiveSlots.slice(0, 5),
    });
    const request2 = RequestHelper.H264.activeSpeaker('360p', {
      receiveSlots: fakeReceiveSlots.slice(5, 10),
      policyInfo: {
        policy: 'active-speaker' as const,
        priority: 254,
        crossPriorityDuplication: true,
        crossPolicyDuplication: true,
        preferLiveVideo: true,
      },
    });
    mediaRequestManager.addRequest(request1, false);
    mediaRequestManager.addRequest(request2, true);

    // check that resulting requests are 5 "medium" 720p streams and 5 "small" 360p streams
    const request1Degraded = {
      ...request1,
      codecInfo: {
        ...request1.codecInfo,
        ...H264_CODEC_PARAMETERS['720p'],
      },
    }
    checkMediaRequestsSent([request1Degraded, request2]);
  })

  it('can degrade only the largest AV1 max-pic-size when request exceeds max macroblocks limit', () => {
    // set max macroblocks limit
    mediaRequestManager.setDegradationPreferences({maxMacroblocksLimit: 32400});
    sendMediaRequestsCallback.resetHistory();

    // request 5 "large" 1080p streams and 5 "small" 360p streams
    const request1 = RequestHelper.AV1.activeSpeaker('1080p', {
      receiveSlots: fakeReceiveSlots.slice(0, 5),
    });
    const request2 = RequestHelper.AV1.activeSpeaker('360p', {
      receiveSlots: fakeReceiveSlots.slice(5, 10),
      policyInfo: {
        policy: 'active-speaker' as const,
        priority: 254,
        crossPriorityDuplication: true,
        crossPolicyDuplication: true,
        preferLiveVideo: true,
      },
    });
    mediaRequestManager.addRequest(request1, false);
    mediaRequestManager.addRequest(request2, true);

    // check that resulting requests are 5 "medium" 720p streams and 5 "small" 360p streams
    // Note: only maxPicSize gets degraded, other parameters stay the same
    const request1Degraded = {
      ...request1,
      codecInfo: {
        ...request1.codecInfo,
        maxPicSize: AV1_CODEC_PARAMETERS['720p'].maxPicSize,
      },
    }
    checkMediaRequestsSent([request1Degraded, request2]);
  })

  it('respects the preferredMaxFs if set', () => {
    sendMediaRequestsCallback.resetHistory();
    const clock = FakeTimers.install({now: Date.now()});

    const request1 = RequestHelper.H264.activeSpeaker('1080p', {
      receiveSlots: fakeReceiveSlots.slice(0, 10),
    });
    mediaRequestManager.addRequest(request1, true);

    sendMediaRequestsCallback.resetHistory();

    const maxFsHandlerCall = fakeReceiveSlots[0].on.getCall(1);
    const maxFsHandler = maxFsHandlerCall.args[1];
    const eventName = maxFsHandlerCall.args[0];

    assert.equal(eventName, 'maxFsUpdate');

    const preferredFrameSize = 100;

    maxFsHandler({maxFs: preferredFrameSize});

    clock.tick(999);

    sinon.assert.notCalled(sendMediaRequestsCallback);

    clock.tick(1);

    // Check that the request was sent with the preferred maxFs
    sinon.assert.calledOnce(sendMediaRequestsCallback);
    const sentRequest = sendMediaRequestsCallback.getCall(0).args[0][0];
    assert.equal(sentRequest.codecInfos[0]['h264'].maxFs, preferredFrameSize);

    clock.uninstall();
  })

  it('respects the preferredMaxPicSize if set for AV1', () => {
    sendMediaRequestsCallback.resetHistory();
    const clock = FakeTimers.install({now: Date.now()});

    const request1 = RequestHelper.AV1.activeSpeaker('1080p', {
      receiveSlots: fakeReceiveSlots.slice(0, 10),
    });
    mediaRequestManager.addRequest(request1, true);

    sendMediaRequestsCallback.resetHistory();

    const maxPicSizeHandlerCall = fakeReceiveSlots[0].on.getCall(2);
    const maxPicSizeHandler = maxPicSizeHandlerCall.args[1];
    const eventName = maxPicSizeHandlerCall.args[0];

    assert.equal(eventName, 'maxPicSizeUpdate');

    const preferredPicSize = 278_784; // 360p maxPicSize

    maxPicSizeHandler({maxPicSize: preferredPicSize});

    clock.tick(999);

    sinon.assert.notCalled(sendMediaRequestsCallback);

    clock.tick(1);

    // Check that the request was sent with the preferred maxPicSize
    sinon.assert.calledOnce(sendMediaRequestsCallback);
    const sentRequest = sendMediaRequestsCallback.getCall(0).args[0][0];
    assert.equal(sentRequest.codecInfos[0]['av1'].maxPicSize, preferredPicSize);

    clock.uninstall();
  })

  it('sends the wcme media requests when commit() is called', () => {
    // send some requests, all of them with commit=false
    const request1 = RequestHelper.H264.receiverSelected('1080p', {
      receiveSlots: [fakeReceiveSlots[0]],
      policyInfo: { policy: 'receiver-selected' as const, csi: 123000 },
    });
    const request2 = RequestHelper.H264.receiverSelected('1080p', {
      receiveSlots: [fakeReceiveSlots[1]],
      policyInfo: { policy: 'receiver-selected' as const, csi: 456000 },
    });
    const request3 = RequestHelper.H264.activeSpeaker('720p', {
      receiveSlots: [fakeReceiveSlots[2], fakeReceiveSlots[3], fakeReceiveSlots[4]],
      policyInfo: {
        policy: 'active-speaker' as const,
        priority: 255,
        crossPriorityDuplication: true,
        crossPolicyDuplication: true,
        preferLiveVideo: true,
      },
    });
    const request4 = RequestHelper.H264.activeSpeaker('720p', {
      receiveSlots: [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
      policyInfo: {
        policy: 'active-speaker' as const,
        priority: 254,
        crossPriorityDuplication: true,
        crossPolicyDuplication: true,
        preferLiveVideo: true,
      },
    });
    const request5 = RequestHelper.H264.activeSpeaker('720p', {
      receiveSlots: [fakeReceiveSlots[8], fakeReceiveSlots[9], fakeReceiveSlots[10]],
      policyInfo: {
        policy: 'active-speaker' as const,
        priority: 254,
        crossPriorityDuplication: true,
        crossPolicyDuplication: true,
        preferLiveVideo: true,
        namedMediaGroups: [{type: 1, value: 20}],
      },
    });

    mediaRequestManager.addRequest(request1, false);
    mediaRequestManager.addRequest(request2, false);
    mediaRequestManager.addRequest(request3, false);
    mediaRequestManager.addRequest(request4, false);
    mediaRequestManager.addRequest(request5, false);

    // nothing should be sent out as we didn't commit the requests
    sinon.assert.notCalled(sendMediaRequestsCallback);

    // now do the commit
    mediaRequestManager.commit();

    // check that all requests have been sent out
    checkMediaRequestsSent([request1, request2, request3, request4, request5]);
  })

  describe('maxPayloadBitsPerSecond', () => {
    beforeEach(() => {
      sendMediaRequestsCallback.resetHistory();
    });

    it('returns the default maxPayloadBitsPerSecond if kind is "audio"', () => {
      const mediaRequestManagerAudio = new MediaRequestManager(sendMediaRequestsCallback, {
        degradationPreferences: {
          maxMacroblocksLimit: Infinity,
        },
        kind: 'audio',
        trimRequestsToNumOfSources: false,
      });
      mediaRequestManagerAudio.setNumCurrentSources(100, 100);
      sendMediaRequestsCallback.resetHistory();

      const request = {
        policyInfo: {
          policy: 'receiver-selected' as const,
          csi: 123,
        },
        receiveSlots: [fakeReceiveSlots[0]],
        codecInfo: undefined,
      };

      mediaRequestManagerAudio.addRequest(request as any, false);
      mediaRequestManagerAudio.commit();

      sinon.assert.calledOnce(sendMediaRequestsCallback);
      const sentRequest = sendMediaRequestsCallback.getCall(0).args[0][0];
      assert.equal(sentRequest.maxPayloadBitsPerSecond, 64000);
    });

    it('returns the recommended maxPayloadBitsPerSecond for H264 if kind is "video"', () => {
      const request = RequestHelper.H264.receiverSelected('1080p', {
        receiveSlots: [fakeReceiveSlots[0]],
        policyInfo: { policy: 'receiver-selected' as const, csi: 123 },
      });

      mediaRequestManager.addRequest(request, false);
      mediaRequestManager.commit();

      sinon.assert.calledOnce(sendMediaRequestsCallback);
      const sentRequest = sendMediaRequestsCallback.getCall(0).args[0][0];
      const expectedBitrate = getRecommendedMaxBitrateForFrameSize(H264_CODEC_PARAMETERS['1080p'].maxFs);
      assert.equal(sentRequest.maxPayloadBitsPerSecond, expectedBitrate);
    });

    it('returns the recommended maxPayloadBitsPerSecond for AV1 if kind is "video"', () => {
      const request = RequestHelper.AV1.receiverSelected('1080p', {
        receiveSlots: [fakeReceiveSlots[0]],
        policyInfo: { policy: 'receiver-selected' as const, csi: 123 },
      });

      mediaRequestManager.addRequest(request, false);
      mediaRequestManager.commit();

      sinon.assert.calledOnce(sendMediaRequestsCallback);
      const sentRequest = sendMediaRequestsCallback.getCall(0).args[0][0];
      const expectedBitrate = getRecommendedMaxBitrateForPicSize(AV1_CODEC_PARAMETERS['1080p'].maxPicSize);
      assert.equal(sentRequest.maxPayloadBitsPerSecond, expectedBitrate);
    });
  });

  describe('maxMbps', () => {
    beforeEach(() => {
      sendMediaRequestsCallback.resetHistory();
    });

    it('returns the correct maxMbps value', () => {
      const request = RequestHelper.H264.receiverSelected('1080p', {
        receiveSlots: [fakeReceiveSlots[0]],
        policyInfo: { policy: 'receiver-selected' as const, csi: 123 },
      });

      mediaRequestManager.addRequest(request, false);
      mediaRequestManager.commit();

      sinon.assert.calledOnce(sendMediaRequestsCallback);
      checkMediaRequestsSent([request]);
    });
  });

  describe('trimming of requested receive slots', () => {
    beforeEach(() => {
      mediaRequestManager = new MediaRequestManager(sendMediaRequestsCallback, {
        degradationPreferences: {
          maxMacroblocksLimit: Infinity,
        },
        kind: 'video',
        trimRequestsToNumOfSources: true,
      });
    });

    const limitNumAvailableStreams = (preferLiveVideo: boolean, limit: number) => {
      if (preferLiveVideo) {
        mediaRequestManager.setNumCurrentSources(100, limit);
      } else {
        mediaRequestManager.setNumCurrentSources(limit, 1);
      }
    };

    [true, false].forEach((preferLiveVideo) =>
      describe(`preferLiveVideo=${preferLiveVideo}`, () => {
        it('trims the active speaker request with lowest priority first and maintains slot order', () => {
          // add some receiver-selected and active-speaker requests, in a mixed up order
          const request1 = RequestHelper.H264.receiverSelected('360p', {
            receiveSlots: [fakeReceiveSlots[0]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 100 },
          });
          const request2 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 254,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });
          const request3 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[7], fakeReceiveSlots[8], fakeReceiveSlots[9]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 253,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });
          const request4 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[4], fakeReceiveSlots[5], fakeReceiveSlots[6]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 255,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });
          const request5 = RequestHelper.H264.receiverSelected('360p', {
            receiveSlots: [fakeReceiveSlots[10]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 101 },
          });

          mediaRequestManager.addRequest(request1, false);
          mediaRequestManager.addRequest(request2, false);
          mediaRequestManager.addRequest(request3, false);
          mediaRequestManager.addRequest(request4, false);
          mediaRequestManager.addRequest(request5, false);

          /* Set number of available streams to 7 so that there will be enough sources only for
            the 2 RS requests and 2 of the 3 AS requests. The lowest priority AS request will
            have all the slots trimmed, the second lowest priority AS request will have 1 slot trimmed */
          limitNumAvailableStreams(preferLiveVideo, 7);

          // check what got trimmed
          const request2Trimmed = {
            ...request2,
            receiveSlots: [fakeReceiveSlots[1], fakeReceiveSlots[2]], // fakeReceiveSlots[3] got trimmed
          };
          // request3 is missing, because all of its slots got trimmed

          checkMediaRequestsSent([request1, request2Trimmed, request4, request5]);

          // now increase the number of available streams so only the last AS request is trimmed by 1
          limitNumAvailableStreams(preferLiveVideo, 10);

          const request3Trimmed = {
            ...request3,
            receiveSlots: [fakeReceiveSlots[7], fakeReceiveSlots[8]], // only 1 slot is trimmed
          };

          checkMediaRequestsSent([request1, request2, request3Trimmed, request4, request5]);
        });

        it('does not trim the receiver selected requests', () => {
          // add some receiver-selected and active-speaker requests, in a mixed up order
          const request1 = RequestHelper.H264.receiverSelected('360p', {
            receiveSlots: [fakeReceiveSlots[0]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 200 },
          });
          const request2 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 255,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });
          const request3 = RequestHelper.H264.receiverSelected('720p', {
            receiveSlots: [fakeReceiveSlots[4]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 201 },
          });
          const request4 = RequestHelper.H264.activeSpeaker('720p', {
            receiveSlots: [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 254,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });

          mediaRequestManager.addRequest(request1, false);
          mediaRequestManager.addRequest(request2, false);
          mediaRequestManager.addRequest(request3, false);
          mediaRequestManager.addRequest(request4, false);

          /* Set number of available streams to 1, which is lower than the number of RS requests,
            so all AS requests will be trimmed to 0 but RS requests should be unaltered */
          limitNumAvailableStreams(preferLiveVideo, 1);

          // check what got trimmed - only RS requests should remain
          checkMediaRequestsSent([request1, request3]);
        });

        it('does trimming first and applies degradationPreferences after that', () => {
          // add some receiver-selected and active-speaker requests
          const request1 = RequestHelper.H264.receiverSelected('360p', {
            receiveSlots: [fakeReceiveSlots[0]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 200 },
          });
          const request2 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 255,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });
          const request3 = RequestHelper.H264.receiverSelected('720p', {
            receiveSlots: [fakeReceiveSlots[4]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 201 },
          });
          const request4 = RequestHelper.H264.activeSpeaker('720p', {
            receiveSlots: [fakeReceiveSlots[5], fakeReceiveSlots[6], fakeReceiveSlots[7]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 254,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });

          mediaRequestManager.addRequest(request1, false);
          mediaRequestManager.addRequest(request2, false);
          mediaRequestManager.addRequest(request3, false);
          mediaRequestManager.addRequest(request4, false);

          // Set maxMacroblocksLimit to a value that's big enough just for the 2 RS requests and 1 AS with 1 slot of 360p.
          // but not big enough for all of the RS and AS requests. If maxMacroblocksLimit
          // was applied first, the resolution of all requests (including RS ones) would be degraded
          // This test verifies that it's not happening and the resolutions are not affected.
          mediaRequestManager.setDegradationPreferences({
            maxMacroblocksLimit: H264_CODEC_PARAMETERS['360p'].maxFs + H264_CODEC_PARAMETERS['720p'].maxFs + H264_CODEC_PARAMETERS['360p'].maxFs
          });
          sendMediaRequestsCallback.resetHistory();

          /* Limit the num of streams so that only 2 RS requests and 1 AS with 1 slot can be sent out */
          limitNumAvailableStreams(preferLiveVideo, 3);

          // check what got trimmed - the remaining requests should have unchanged resolutions
          const request2Trimmed = {
            ...request2,
            receiveSlots: [fakeReceiveSlots[1]],
          };

          checkMediaRequestsSent([request1, request2Trimmed, request3]);
        });

        it('trims all AS requests completely until setNumCurrentSources() is called with non-zero values', () => {
          // add some receiver-selected and active-speaker requests
          const request1 = RequestHelper.H264.receiverSelected('360p', {
            receiveSlots: [fakeReceiveSlots[0]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 200 },
          });
          const request2 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 255,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });
          const request3 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[5]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 254,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });

          mediaRequestManager.addRequest(request1, false);
          mediaRequestManager.addRequest(request2, false);
          mediaRequestManager.addRequest(request3, false);

          mediaRequestManager.commit();

          // we're not calling setNumCurrentSources(), so it should use the initial values of 0 for sources count
          // and completely trim all AS requests to 0
          checkMediaRequestsSent([request1]);
        });

        it('resets num of sources to 0 when reset() is called', () => {
          // set available streams to non-zero value
          limitNumAvailableStreams(preferLiveVideo, 4);
          sendMediaRequestsCallback.resetHistory();

          // do the reset
          mediaRequestManager.reset();

          // add some receiver-selected and active-speaker requests
          const request1 = RequestHelper.H264.receiverSelected('360p', {
            receiveSlots: [fakeReceiveSlots[0]],
            policyInfo: { policy: 'receiver-selected' as const, csi: 200 },
          });
          const request2 = RequestHelper.H264.activeSpeaker('360p', {
            receiveSlots: [fakeReceiveSlots[1], fakeReceiveSlots[2], fakeReceiveSlots[3]],
            policyInfo: {
              policy: 'active-speaker' as const,
              priority: 255,
              crossPriorityDuplication: true,
              crossPolicyDuplication: true,
              preferLiveVideo,
            },
          });

          mediaRequestManager.addRequest(request1, false);
          mediaRequestManager.addRequest(request2, false);

          mediaRequestManager.commit();

          // verify that AS request was trimmed to 0, because we've reset mediaRequestManager so available streams count is 0 now
          checkMediaRequestsSent([request1]);
        });
      })
    );

    it('throws if there are 2 active-speaker requests with different preferLiveVideo values', () => {
      const request1 = RequestHelper.H264.activeSpeaker('360p', {
        receiveSlots: [fakeReceiveSlots[0]],
        policyInfo: {
          policy: 'active-speaker' as const,
          priority: 255,
          crossPriorityDuplication: true,
          crossPolicyDuplication: true,
          preferLiveVideo: true,
        },
      });
      const request2 = RequestHelper.H264.receiverSelected('720p', {
        receiveSlots: [fakeReceiveSlots[4]],
        policyInfo: { policy: 'receiver-selected' as const, csi: 201 },
      });
      const request3 = RequestHelper.H264.activeSpeaker('360p', {
        receiveSlots: [fakeReceiveSlots[2]],
        policyInfo: {
          policy: 'active-speaker' as const,
          priority: 254,
          crossPriorityDuplication: true,
          crossPolicyDuplication: true,
          preferLiveVideo: false,
        },
      });

      mediaRequestManager.addRequest(request1, false);
      mediaRequestManager.addRequest(request2, false);
      mediaRequestManager.addRequest(request3, false);

      assert.throws(() => mediaRequestManager.commit(), 'a mix of active-speaker groups with different values for preferLiveVideo is not supported');
    });
  });
});

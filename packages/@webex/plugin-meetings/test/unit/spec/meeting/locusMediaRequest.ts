import 'jsdom-global/register';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import { cloneDeep } from 'lodash';

import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import { LocalMuteRequest, LocusMediaRequest, RoapRequest } from "@webex/plugin-meetings/src/meeting/locusMediaRequest";
import testUtils from '../../../utils/testUtils';
import { Defer } from '@webex/common';
import { IP_VERSION } from '../../../../src/constants';

describe('LocusMediaRequest.send()', () => {
  let locusMediaRequest: LocusMediaRequest;
  let webexRequestStub;
  let mockWebex;

  const fakeLocusResponse = {
    locus: { something: 'whatever'}
  };

  const exampleRoapRequestBody:RoapRequest = {
    type: 'RoapMessage',
    mediaId: 'mediaId',
    selfUrl: 'fakeMeetingSelfUrl',
    roapMessage: {
      messageType: 'OFFER',
      sdps: ['sdp'],
      version: '2',
      seq: 1,
      tieBreaker: 0xfffffffe,
    },
    reachability: {
      'wjfkm.wjfkm.*': {udp:{reachable: true}, tcp:{reachable:false}},
      '1eb65fdf-9643-417f-9974-ad72cae0e10f.59268c12-7a04-4b23-a1a1-4c74be03019a.*': {udp:{reachable: false}, tcp:{reachable:true}},
    },
    joinCookie: {
      anycastEntryPoint: 'aws-eu-west-1',
      clientIpAddress: 'some ip',
      timeShot: '2023-05-23T08:03:49Z',
    },
    ipVersion: IP_VERSION.only_ipv4,
  };

  const createExpectedRoapBody = (expectedMessageType, expectedMute:{audioMuted: boolean, videoMuted: boolean}) => {
    return {
      device: { url: 'deviceUrl', deviceType: 'deviceType', regionCode: 'regionCode' },
      correlationId: 'correlationId',
      localMedias: [
        {
          localSdp: `{"audioMuted":${expectedMute.audioMuted},"videoMuted":${expectedMute.videoMuted},"roapMessage":{"messageType":"${expectedMessageType}","sdps":["sdp"],"version":"2","seq":1,"tieBreaker":4294967294},"reachability":{"wjfkm.wjfkm.*":{"udp":{"reachable":true},"tcp":{"reachable":false}},"1eb65fdf-9643-417f-9974-ad72cae0e10f.59268c12-7a04-4b23-a1a1-4c74be03019a.*":{"udp":{"reachable":false},"tcp":{"reachable":true}}}}`,
          mediaId: 'mediaId'
        }
      ],
      clientMediaPreferences: {
        preferTranscoding: true,
        ipver: 4,
        joinCookie: {
          anycastEntryPoint: 'aws-eu-west-1',
          clientIpAddress: 'some ip',
          timeShot: '2023-05-23T08:03:49Z'
        }
      }
    };
  };

  const exampleLocalMuteRequestBody:LocalMuteRequest = {
    type: 'LocalMute',
    mediaId: 'mediaId',
    selfUrl: 'fakeMeetingSelfUrl',
    muteOptions: {},
  };

  const createExpectedLocalMuteBody = (expectedMute:{audioMuted: boolean, videoMuted: boolean}, sequence = undefined) => {
    const body: any = {
      device: {
        url: 'deviceUrl',
        deviceType: 'deviceType',
        regionCode: 'regionCode',
      },
      correlationId: 'correlationId',
      usingResource: null,
      respOnlySdp: true,
      localMedias: [
        {
          mediaId: 'mediaId',
          localSdp: `{"audioMuted":${expectedMute.audioMuted},"videoMuted":${expectedMute.videoMuted}}`,
        },
      ],
      clientMediaPreferences: {
        preferTranscoding: true,
        ipver: undefined,
      },
    };

    if (sequence) {
      body.sequence = sequence;
    }

    return body;
  };

  beforeEach(() => {
    mockWebex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    mockWebex.internal = {
      newMetrics: {
        submitClientEvent: sinon.stub()
      },
    };

    locusMediaRequest = new LocusMediaRequest({
      device: {
        url: 'deviceUrl',
        deviceType: 'deviceType',
        regionCode: 'regionCode',
      },
      correlationId: 'correlationId',
      meetingId: 'meetingId',
      preferTranscoding: true,
    }, {
      parent: mockWebex,
    });
    webexRequestStub = sinon.stub(locusMediaRequest, 'request').resolves(fakeLocusResponse);
  })

  const sendLocalMute = (muteOptions, overrides={}) => locusMediaRequest.send({...exampleLocalMuteRequestBody, ...overrides, muteOptions});

  const sendRoapMessage = (messageType) => {
    const request = cloneDeep(exampleRoapRequestBody);

    request.roapMessage.messageType = messageType;
    return locusMediaRequest.send(request);
  }

  /** Helper function that makes sure the LocusMediaRequest.confluenceState is 'created' */
  const ensureConfluenceCreated = async () => {
    await sendRoapMessage('OFFER');

    webexRequestStub.resetHistory();
    mockWebex.internal.newMetrics.submitClientEvent.resetHistory();
  }

  const checkMetrics = (expectedMetrics: boolean = true) => {
    if (expectedMetrics) {
      assert.calledWith(mockWebex.internal.newMetrics.submitClientEvent, {
        name: 'client.locus.media.request',
        options: {
          meetingId: 'meetingId',
        },
      });

      assert.calledWith(mockWebex.internal.newMetrics.submitClientEvent, {
        name: 'client.locus.media.response',
        options: {
          meetingId: 'meetingId',
        },
      });
    } else {
      assert.notCalled(mockWebex.internal.newMetrics.submitClientEvent);
    }
  }

  it('sends a roap message', async () => {
    const result = await sendRoapMessage('OFFER');

    assert.equal(result, fakeLocusResponse);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedRoapBody('OFFER', {audioMuted: true, videoMuted: true}),
    });

    checkMetrics();
  });

  it('sends correct metric event when roap message fails', async () => {
    webexRequestStub.rejects({code: 300, message: 'fake error'});
    await assert.isRejected(sendRoapMessage('OFFER'));

    assert.calledWith(mockWebex.internal.newMetrics.submitClientEvent, {
      name: 'client.locus.media.response',
      options: {
        meetingId: 'meetingId',
        rawError: {code: 300, message: 'fake error'},
      },
    });
  });

  it('sends a local mute request', async () => {
    await ensureConfluenceCreated();

    const result = await sendLocalMute({audioMuted: false, videoMuted: false});

    assert.equal(result, fakeLocusResponse);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedLocalMuteBody({audioMuted: false, videoMuted: false}),
    });

    checkMetrics(false);
  });

  it('sends a local mute request with sequence', async () => {
    await ensureConfluenceCreated();

    const sequence = {some: 'sequence data'};

    const result = await sendLocalMute({audioMuted: false, videoMuted: false}, {sequence});

    assert.equal(result, fakeLocusResponse);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedLocalMuteBody({audioMuted: false, videoMuted: false}, sequence),
    });
  });

  it('sends a local mute request with the last audio/video mute values when called multiple times in same processing cycle', async () => {
    await ensureConfluenceCreated();

    let result1;
    let result2;

    const promise1 = sendLocalMute({audioMuted: true, videoMuted: false})
      .then((result) => {
        result1 = result;
      });

    const promise2 = sendLocalMute({audioMuted: false, videoMuted: true})
      .then((result) => {
        result2 = result;
      });

    await testUtils.flushPromises();

    await promise1;
    await promise2;
    assert.equal(result1, fakeLocusResponse);
    assert.equal(result2, fakeLocusResponse);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedLocalMuteBody({audioMuted: false, videoMuted: true}),
    });

    checkMetrics(false);
  });

  it('sends a local mute request with the last audio/video mute values', async () => {
    await ensureConfluenceCreated();

    await Promise.all([
      sendLocalMute({audioMuted: undefined, videoMuted: false}),
      sendLocalMute({audioMuted: true, videoMuted: undefined}),
      sendLocalMute({audioMuted: false, videoMuted: true}),
      sendLocalMute({audioMuted: true, videoMuted: false}),
    ]);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedLocalMuteBody({audioMuted: true, videoMuted: false}),
    });

    checkMetrics(false);
  });

  it('sends only roap when roap and local mute are requested', async () => {
    await Promise.all([
      sendLocalMute({audioMuted: false, videoMuted: undefined}),
      sendRoapMessage('OFFER'),
      sendLocalMute({audioMuted: true, videoMuted: false}),
    ]);

    /* check that only the roap message was sent and it had the last
       values for audio and video mute
    */
    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedRoapBody('OFFER', {audioMuted: true, videoMuted: false}),
    });

    checkMetrics();
  });

  describe('queueing', () => {
    let clock;
    let requestsToLocus;
    let results;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      requestsToLocus = [];
      results = [];

      // setup the mock so that each new request that we send to Locus,
      // returns a promise that we control from this test
      webexRequestStub.callsFake(() => {
        const defer = new Defer();
        requestsToLocus.push(defer);
        return defer.promise;
      });
    });

    afterEach(() => {
      clock.restore();
    });

    /** LocusMediaRequest.send() uses Lodash.defer(), so it only starts sending any requests
     * after the processing cycle from which it was called is finished.
     * This helper function waits for this to happen - it's needed, because we're using
     * fake timers in these tests
    */
    const ensureQueueProcessingIsStarted = () => {
      clock.tick(1);
    }
    it('queues requests if there is one already in progress', async () => {
      results.push(sendRoapMessage('OFFER'));

      ensureQueueProcessingIsStarted();

      // check that OFFER has been sent out
      assert.calledWith(webexRequestStub, {
        method: 'PUT',
        uri: 'fakeMeetingSelfUrl/media',
        body: createExpectedRoapBody('OFFER', {audioMuted: true, videoMuted: true}),
      });

      webexRequestStub.resetHistory();

      // at this point the request should be sent out and "in progress",
      // so any further calls should be queued
      results.push(sendRoapMessage('OK'));

      // OK should not be sent out yet, only queued
      assert.notCalled(webexRequestStub);

      // now simulate the first locus request (offer) to resolve,
      // so that the next request from the queue (ok) can be sent out
      requestsToLocus[0].resolve();
      await testUtils.flushPromises();
      ensureQueueProcessingIsStarted();

      // verify OK was sent out
      assert.calledWith(webexRequestStub, {
        method: 'PUT',
        uri: 'fakeMeetingSelfUrl/media',
        body: createExpectedRoapBody('OK', {audioMuted: true, videoMuted: true}),
      });

      // promise returned by the first call to send OFFER should be resolved by now
      await results[0];

      // simulate Locus sending http response to OK
      requestsToLocus[1].resolve();
      await results[1];
    });

    it('combines local mute requests into a single /media request to Locus when queueing', async () => {
      results.push(sendRoapMessage('OFFER'));
      results.push(sendLocalMute({audioMuted: false, videoMuted: false}));

      ensureQueueProcessingIsStarted();

      // check that OFFER and local mute have been combined into
      // a single OFFER request with the right mute values
      assert.calledOnceWithExactly(webexRequestStub, {
        method: 'PUT',
        uri: 'fakeMeetingSelfUrl/media',
        body: createExpectedRoapBody('OFFER', {audioMuted: false, videoMuted: false}),
      });

      webexRequestStub.resetHistory();

      // at this point the request should be sent out and "in progress",
      // so any further calls should be queued
      results.push(sendLocalMute({audioMuted: true, videoMuted: false}));
      results.push(sendRoapMessage('OK'));
      results.push(sendLocalMute({audioMuted: false, videoMuted: true}));

      // nothing should be sent out yet, only queued
      assert.notCalled(webexRequestStub);

      // now simulate the first locus request (offer) to resolve,
      // so that the next request from the queue (ok) can be sent out
      requestsToLocus[0].resolve();
      await testUtils.flushPromises();
      ensureQueueProcessingIsStarted();

      // verify OK was sent out
      assert.calledOnceWithExactly(webexRequestStub, {
        method: 'PUT',
        uri: 'fakeMeetingSelfUrl/media',
        body: createExpectedRoapBody('OK', {audioMuted: false, videoMuted: true}),
      });

      // promise returned by the first call to send OFFER should be resolved by now
      await results[0];

      // simulate Locus sending http response to OK
      requestsToLocus[1].resolve();
      await results[1];
    });

    describe('confluence creation', () => {
      it('resolves without sending the request if LocalMute is requested before Roap Offer is sent (confluence state is "not created")', async () => {
        assert.equal(locusMediaRequest.isConfluenceCreated(), false);

        const result = await sendLocalMute({audioMuted: false, videoMuted: true});

        assert.notCalled(webexRequestStub);
        assert.deepEqual(result, {});
      });

      it('queues LocalMute if requested after first Roap Offer was sent but before it got http response (confluence state is "creation in progress")', async () => {
        let result;

        // send roap offer so that confluence state is "creation in progress"
        sendRoapMessage('OFFER');

        ensureQueueProcessingIsStarted();

        sendLocalMute({audioMuted: false, videoMuted: true})
          .then((response) => {
            result = response;
          });

        // only roap offer should have been sent so far
        assert.calledOnceWithExactly(webexRequestStub, {
          method: 'PUT',
          uri: 'fakeMeetingSelfUrl/media',
          body: createExpectedRoapBody('OFFER', {audioMuted: true, videoMuted: true}),
        });
        assert.equal(result, undefined); // sendLocalMute shouldn't resolve yet, as the request should be queued
        assert.equal(locusMediaRequest.isConfluenceCreated(), false);

        // now let the Offer be completed - so confluence state will be "complete"
        webexRequestStub.resetHistory();
        requestsToLocus[0].resolve({});
        await testUtils.flushPromises();

        assert.equal(locusMediaRequest.isConfluenceCreated(), true);

        // now the queued up local mute request should have been sent out
        assert.calledOnceWithExactly(webexRequestStub, {
          method: 'PUT',
          uri: 'fakeMeetingSelfUrl/media',
          body: createExpectedLocalMuteBody({audioMuted: false, videoMuted: true}),
        });

        // check also the result once Locus replies to local mute
        const fakeLocusResponse = { response: 'ok'};
        requestsToLocus[1].resolve(fakeLocusResponse);
        await testUtils.flushPromises();
        assert.deepEqual(result, fakeLocusResponse);
      });
    });

    it('sends LocalMute request if Offer was already sent and Locus replied (confluence state is "completed")', async () => {
      let result;

      // send roap offer and ensure it's completed
      sendRoapMessage('OFFER');
      ensureQueueProcessingIsStarted();
      requestsToLocus[0].resolve({});
      await testUtils.flushPromises();
      webexRequestStub.resetHistory();

      assert.equal(locusMediaRequest.isConfluenceCreated(), true);

      // now send local mute
      sendLocalMute({audioMuted: false, videoMuted: true})
        .then((response) => {
          result = response;
        });

      ensureQueueProcessingIsStarted();

      // it should be sent out
      assert.calledOnceWithExactly(webexRequestStub, {
        method: 'PUT',
        uri: 'fakeMeetingSelfUrl/media',
        body: createExpectedLocalMuteBody({audioMuted: false, videoMuted: true}),
      });
    });

  });
})

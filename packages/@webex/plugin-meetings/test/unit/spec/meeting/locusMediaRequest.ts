import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import { cloneDeep, defer } from 'lodash';

import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import { LocalMuteRequest, LocusMediaRequest, RoapRequest } from "@webex/plugin-meetings/src/meeting/locusMediaRequest";
import testUtils from '../../../utils/testUtils';
import { Defer } from '@webex/common';

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
  };

  const createExpectedRoapBody = (expectedMessageType, expectedMute:{audioMuted: boolean, videoMuted: boolean}) => {
    return {
      device: { url: 'deviceUrl', deviceType: 'deviceType' },
      correlationId: 'correlationId',
      localMedias: [
        {
          localSdp: `{"audioMuted":${expectedMute.audioMuted},"videoMuted":${expectedMute.videoMuted},"roapMessage":{"messageType":"${expectedMessageType}","sdps":["sdp"],"version":"2","seq":1,"tieBreaker":4294967294},"reachability":{"wjfkm.wjfkm.*":{"udp":{"reachable":true},"tcp":{"reachable":false}},"1eb65fdf-9643-417f-9974-ad72cae0e10f.59268c12-7a04-4b23-a1a1-4c74be03019a.*":{"udp":{"reachable":false},"tcp":{"reachable":true}}}}`,
          mediaId: 'mediaId'
        }
      ],
      clientMediaPreferences: {
        preferTranscoding: true,
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

  const createExpectedLocalMuteBody = (expectedMute:{audioMuted: boolean, videoMuted: boolean}) => {
    return {
      device: {
        url: 'deviceUrl',
        deviceType: 'deviceType',
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
      },
    }
  };

  beforeEach(() => {
    mockWebex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    locusMediaRequest = new LocusMediaRequest({
      device: {
        url: 'deviceUrl',
        deviceType: 'deviceType',
      },
      correlationId: 'correlationId',
      preferTranscoding: true,
    }, {
      parent: mockWebex,
    });
    webexRequestStub = sinon.stub(locusMediaRequest, 'request').resolves(fakeLocusResponse);
  })

  const sendLocalMute = (muteOptions) => locusMediaRequest.send({...exampleLocalMuteRequestBody, muteOptions});

  const sendRoapMessage = (messageType) => {
    const request = cloneDeep(exampleRoapRequestBody);

    request.roapMessage.messageType = messageType;
    return locusMediaRequest.send(request);
  }

  it('sends a roap message', async () => {
    const result = await sendRoapMessage('OFFER');

    assert.equal(result, fakeLocusResponse);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedRoapBody('OFFER', {audioMuted: true, videoMuted: true}),
    });
  });

  it('sends a local mute request', async () => {
    const result = await sendLocalMute({audioMuted: false, videoMuted: false});

    assert.equal(result, fakeLocusResponse);

    assert.calledOnceWithExactly(webexRequestStub, {
      method: 'PUT',
      uri: 'fakeMeetingSelfUrl/media',
      body: createExpectedLocalMuteBody({audioMuted: false, videoMuted: false}),
    });
  });

  it('sends a local mute request with the last audio/video mute values when called multiple times in same processing cycle', async () => {
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

  });

  it('sends a local mute request with the last audio/video mute values', async () => {
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

  });

  it('sends roap and local mute request', async () => {
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

    it('queues requests if there is one already in progress', async () => {
      results.push(sendRoapMessage('OFFER'));

      clock.tick(1);

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

      // not simulate the first locus request (offer) to resolve,
      // so that the next request from the queue (ok) can be sent out
      requestsToLocus[0].resolve();
      await testUtils.flushPromises();
      clock.tick(1);

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

      clock.tick(1);

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
      clock.tick(1);

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
  });


})
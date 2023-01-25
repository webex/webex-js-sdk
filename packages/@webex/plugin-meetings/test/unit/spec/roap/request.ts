import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import Metrics from '@webex/plugin-meetings/src/metrics';

import RoapRequest from '@webex/plugin-meetings/src/roap/request';


describe('RoapRequest', () => {
  describe('attachRechabilityData', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex();
    });
    
    it('attaches the reachability data when it exists', async () => {
      // @ts-ignore
      const roapRequest = new RoapRequest({}, {parent: webex});

      const sdp = {some: 'attribute'};

      const reachabilitData = {reachability: 'data'};

      await webex.boundedStorage.put(
        'Reachability',
        'reachability.result',
        JSON.stringify(reachabilitData)
      );

      const newSdp = await roapRequest.attachRechabilityData(sdp);

      assert.deepEqual(newSdp, {
        some: 'attribute',
        reachability: reachabilitData
      })
    });
  
    it('handles the case when realiability data does not exist', async () => {
      // @ts-ignore
      const roapRequest = new RoapRequest({}, {parent: webex});

      const sdp = {some: 'attribute'};

      const newSdp = await roapRequest.attachRechabilityData(sdp);

      assert.deepEqual(newSdp, sdp);
    });
  });

  describe('sendRoap', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex();
    });

    it('calls attachReliabilityData', async () => {
      Metrics.postEvent = sinon.stub();

      // @ts-ignore
      const roapRequest = new RoapRequest({}, {parent: webex});

      const newSdp = {new: 'sdp'}

      roapRequest.attachRechabilityData = sinon.stub().returns(Promise.resolve(newSdp));
      webex.request.returns(Promise.resolve({
        body: {
          locus: {}
        }
      }))

      const result = await roapRequest.sendRoap({
        roapMessage: {seq: 1},
        locusSelfUrl: 'locusSelfUrl',
        mediaId: 'mediaId',
        correlationId: 'correlationId',
        audioMuted: true,
        videoMuted: true,
        meetingId: 'meetingId',
        preferTranscoding: true
      });

      assert.calledOnceWithExactly(webex.request, {
        uri: 'locusSelfUrl/media',
        method: 'PUT',
        body: {
          device: {
            url: undefined,
            deviceType: undefined,
          },
          correlationId: 'correlationId',
          localMedias: [{
            localSdp: JSON.stringify(newSdp),
            mediaId: 'mediaId'
          }],
          clientMediaPreferences: {preferTranscoding: true}
        },
      });

      assert.calledOnceWithExactly(roapRequest.attachRechabilityData, {
        roapMessage: {seq: 1},
        audioMuted: true,
        videoMuted: true
      })

      assert.deepEqual(result, {
        locus: {
          roapSeq: 1
        }
      });
    });
  })
});

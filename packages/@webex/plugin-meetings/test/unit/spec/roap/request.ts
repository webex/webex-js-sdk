import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import Metrics from '@webex/plugin-meetings/src/metrics';
import {REACHABILITY} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings/roap', () => {
  let roapRequest;
  let webex;
  const locusUrl = 'locusUrl';

  beforeEach(async () => {
    webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    webex.meetings.clientRegion = {
      countryCode: 'US',
      regionCode: 'WEST-COAST',
    };

    webex.internal = {
      services: {
        get: sinon.mock().returns(locusUrl),
        waitForCatalog: sinon.mock().returns(Promise.resolve({})),
      },
      device: {
        url: 'url',
      },
    };

    // @ts-ignore
    roapRequest = new RoapRequest({webex});

    roapRequest.request = sinon.mock().returns(
      Promise.resolve({
        body: {
          locus: {
            roapSeq: '',
            id: '',
            url: 'url/path',
            fullState: {
              lastActive: 'lastActive',
            },
          },
        },
      })
    );

    Metrics.postEvent = sinon.stub().returns();

    await webex.boundedStorage.put(
      REACHABILITY.namespace,
      REACHABILITY.localStorageJoinCookie,
      JSON.stringify({
        anycastEntryPoint: 'aws-eu-west-1',
      })
    );
    await webex.boundedStorage.put(
      REACHABILITY.namespace,
      REACHABILITY.localStorageResult,
      JSON.stringify({
        clusterId: {
          udp: 'test',
        },
      })
    );
  });

  describe('#attachReachabilityData', () => {
    it('returns the correct reachability data', async () => {
      const res = await roapRequest.attachReachabilityData({});

      assert.deepEqual(res.localSdp, {
        reachability: {
          clusterId: {
            udp: 'test',
          },
        },
      });
      assert.deepEqual(res.joinCookie, {
        anycastEntryPoint: 'aws-eu-west-1',
      });
    });

    it('handles the case when reachability data does not exist', async () => {
      await webex.boundedStorage.del(REACHABILITY.namespace, REACHABILITY.localStorageJoinCookie);

      await webex.boundedStorage.del(REACHABILITY.namespace, REACHABILITY.localStorageResult);
      const sdp = {
        some: 'attribute',
      };

      const result = await roapRequest.attachReachabilityData(sdp);

      assert.deepEqual(result, {
        joinCookie: undefined,
        localSdp: {
          some: 'attribute',
        },
      });
    });
  });

  describe('sendRoap', () => {
    it('includes joinCookie in the request correctly', async () => {
      const locusMediaRequest = { send: sinon.stub().resolves({body: {locus: {}}})};

      await roapRequest.sendRoap({
        locusSelfUrl: locusUrl,
        mediaId: 'mediaId',
        roapMessage: {
          seq: 'seq',
        },
        locusMediaRequest,
      });

      const requestParams = locusMediaRequest.send.getCall(0).args[0];
      assert.deepEqual(requestParams, {
        type: 'RoapMessage',
        selfUrl: locusUrl,
        joinCookie: {
          anycastEntryPoint: 'aws-eu-west-1',
        },
        mediaId: 'mediaId',
        roapMessage: {
          seq: 'seq',
        },
        reachability: {clusterId:{udp:"test"}},
      });
    });
  });

  it('calls attachReachabilityData when sendRoap', async () => {
    const locusMediaRequest = { send: sinon.stub().resolves({body: {locus: {}}})};

    const newSdp = {
      new: 'sdp',
      reachability: { someResult: 'whatever' }
    };

    roapRequest.attachReachabilityData = sinon.stub().returns(
      Promise.resolve({
        localSdp: newSdp,
        joinCookie: {
          anycastEntryPoint: 'aws-eu-west-1',
        },
      })
    );

    await roapRequest.sendRoap({
      roapMessage: {
        seq: 1,
      },
      locusSelfUrl: 'locusSelfUrl',
      mediaId: 'mediaId',
      meetingId: 'meetingId',
      preferTranscoding: true,
      locusMediaRequest
    });

    const requestParams = locusMediaRequest.send.getCall(0).args[0];

    assert.deepEqual(requestParams, {
      type: 'RoapMessage',
      selfUrl: 'locusSelfUrl',
      joinCookie: {
        anycastEntryPoint: 'aws-eu-west-1',
      },
      mediaId: 'mediaId',
      roapMessage: {
        seq: 1,
      },
      reachability: { someResult: 'whatever' },
    });

    assert.calledOnceWithExactly(roapRequest.attachReachabilityData, {
      roapMessage: {
        seq: 1,
      },
    });
  });
});

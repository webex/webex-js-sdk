import sinon from 'sinon';
import {
  assert
} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import Metrics from '@webex/plugin-meetings/src/metrics';
import { REACHABILITY } from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings/roap', () => {
  let roapRequest;
  let webex;
  const locusUrl = 'locusUrl'

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
        url: "url"
      }
    };

    roapRequest = new RoapRequest({}, {
      parent: webex,
    });

    roapRequest.request = sinon.mock().returns(Promise.resolve({
      body: {
        locus: {
          roapSeq: "",
          id: "",
          url: "url/path",
          fullState: {
            lastActive: "lastActive",
          }
        }
      }
    }));

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
  });

  describe("sendRoap", () => {
    it('includes joinCookie in the request correctly', async () => {
      await roapRequest.sendRoap({
        locusSelfUrl: locusUrl,
        mediaId: "mediaId",
        roapMessage: {
          seq: "seq"
        }
      });

      const requestParams = roapRequest.request.getCall(0).args[0];
      assert.equal(requestParams.method, 'PUT');
      assert.equal(requestParams.uri, `${locusUrl}/media`);
      assert.deepEqual(requestParams.body.localMedias, [{
        localSdp: "{\"roapMessage\":{\"seq\":\"seq\"},\"audioMuted\":false,\"videoMuted\":false,\"reachability\":{\"clusterId\":{\"udp\":\"test\"}}}",
        mediaId: "mediaId",
      }]);
      assert.deepEqual(requestParams.body.clientMediaPreferences, {
        "joinCookie": {
          "anycastEntryPoint": "aws-eu-west-1"
        },
        "preferTranscoding": true
      });
    })
  })
});

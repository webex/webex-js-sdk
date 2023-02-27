import sinon from 'sinon';
import {
  assert
} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import Metrics from '@webex/plugin-meetings/src/metrics';

describe('plugin-meetings/roap', () => {
  let roapRequest;
  let webex;
  const locusUrl = 'locusUrl'

  before(function () {
    this.jsdom = require('jsdom-global')('', {
      url: 'http://localhost',
    });
  });
  after(function () {
    this.jsdom();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  beforeEach(() => {
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

    window.localStorage.setItem(
      'reachability.joinCookie',
      JSON.stringify({
        anycastEntryPoint: 'aws-eu-west-1',
      })
    );
    window.localStorage.setItem(
      'reachability.result',
      JSON.stringify({
        clusterId: {
          udp: 'test',
        },
      })
    );
  });

  describe('#attachRechabilityData', () => {
    it('returns the correct reachability data', async () => {
      const res = await roapRequest.attachRechabilityData({});

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

  describe("joinMeetingWithRoap", () => {
    it('includes joinCookie in the request correctly', async () => {
      await roapRequest.joinMeetingWithRoap({
        locusUrl,
        roapMessage: {
          seq: "seq"
        }
      });

      const requestParams = roapRequest.request.getCall(0).args[0];
      assert.equal(requestParams.method, 'POST');
      assert.equal(requestParams.uri, `${locusUrl}/participant`);
      assert.deepEqual(requestParams.body.localMedias, [{
        localSdp: "{\"roapMessage\":{\"seq\":\"seq\"},\"audioMuted\":false,\"videoMuted\":false,\"reachability\":{\"clusterId\":{\"udp\":\"test\"}}}"
      }]);
      assert.deepEqual(requestParams.body.clientMediaPreferences, {
        "joinCookie": {
          "anycastEntryPoint": "aws-eu-west-1"
        },
        "preferTranscoding": true
      });
    })
  })

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

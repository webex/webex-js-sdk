import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import ReachabilityRequest from '@webex/plugin-meetings/src/reachability/request';


describe('plugin-meetings/reachability', () => {
  let reachabilityRequest;
  let webex;

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
        get: sinon.mock().returns('locusUrl'),
        waitForCatalog: sinon.mock().returns(Promise.resolve({})),
      },
    };


    reachabilityRequest = new ReachabilityRequest(webex);

  });

  describe('#getClusters', () => {
    it('sends a GET request with the correct params', async () => {
      webex.request = sinon.mock().returns(Promise.resolve({
        body: {
          clusterClasses: {
            hybridMedia: ["clusterId"]
          },
          clusters: {"clusterId": {
            udp: "testUDP"
          }},
          joinCookie: {anycastEntryPoint: "aws-eu-west-1"}
        }
      }));

      const res = await reachabilityRequest.getClusters();

      const requestParams = webex.request.getCall(0).args[0];

      assert.equal(requestParams.method, 'GET');
      assert.equal(requestParams.resource, `clusters`);
      assert.equal(requestParams.api, 'calliopeDiscovery');
      assert.equal(requestParams.shouldRefreshAccessToken, false);

      assert.deepEqual(requestParams.qs, {
        JCSupport: 1,
      });
      assert.deepEqual(res.clusters.clusterId, {udp: "testUDP", isVideoMesh: true})
      assert.deepEqual(res.joinCookie, {anycastEntryPoint: "aws-eu-west-1"})
    });
  });
});

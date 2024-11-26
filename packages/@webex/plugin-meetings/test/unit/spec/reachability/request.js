import 'jsdom-global/register';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import ReachabilityRequest from '@webex/plugin-meetings/src/reachability/request';
import {IP_VERSION} from '@webex/plugin-meetings/src/constants';
import {NewMetrics} from '@webex/internal-plugin-metrics';


describe('plugin-meetings/reachability', () => {
  let reachabilityRequest;
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        meetings: Meetings,
        newMetrics: NewMetrics
      },
    });

    webex.meetings.clientRegion = {
      countryCode: 'US',
      regionCode: 'WEST-COAST',
    };

    webex.internal.services = {
      get: sinon.mock().returns('locusUrl'),
      waitForCatalog: sinon.mock().returns(Promise.resolve({})),
    };

    reachabilityRequest = new ReachabilityRequest(webex);

  });

  describe('#getClusters', () => {

    beforeEach(() => {
      sinon.spy(webex.internal.newMetrics.callDiagnosticLatencies, 'measureLatency');
    });

    afterEach(() => {
      sinon.restore();
    });

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

      webex.config.meetings.reachabilityGetClusterTimeout = 3000;

      const res = await reachabilityRequest.getClusters(IP_VERSION.only_ipv4);
      const requestParams = webex.request.getCall(0).args[0];

      assert.deepEqual(requestParams, {
        method: 'GET',
        resource: `clusters`,
        api: 'calliopeDiscovery',
        shouldRefreshAccessToken: false,
        qs: {
          JCSupport: 1,
          ipver: 4,
        },
        timeout: 3000,
      });

      assert.deepEqual(res.clusters.clusterId, {udp: "testUDP", isVideoMesh: true})
      assert.deepEqual(res.joinCookie, {anycastEntryPoint: "aws-eu-west-1"})
      assert.calledOnceWithExactly(webex.internal.newMetrics.callDiagnosticLatencies.measureLatency, sinon.match.func, 'internal.get.cluster.time');
    });
  });
});

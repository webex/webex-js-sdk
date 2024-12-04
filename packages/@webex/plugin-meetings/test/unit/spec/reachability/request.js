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
    let previousReport;

    beforeEach(() => {
      sinon.spy(webex.internal.newMetrics.callDiagnosticLatencies, 'measureLatency');

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

      previousReport = {
        id: 'fake previous report',
      }
    });

    afterEach(() => {
      sinon.restore();
    });

    it('sends a POST request with the correct params when trigger is "startup"', async () => {
      const res = await reachabilityRequest.getClusters('startup', IP_VERSION.only_ipv4, previousReport);
      const requestParams = webex.request.getCall(0).args[0];

      assert.deepEqual(requestParams, {
        method: 'POST',
        resource: `clusters`,
        api: 'calliopeDiscovery',
        shouldRefreshAccessToken: false,
        timeout: 3000,
        body: {
          ipver: IP_VERSION.only_ipv4,
          'supported-options': {
            'report-version': 1,
            'early-call-min-clusters': true,
          },
          'previous-report': previousReport,
          trigger: 'startup',
        },
      });

      assert.deepEqual(res.clusters.clusterId, {udp: "testUDP", isVideoMesh: true})
      assert.deepEqual(res.joinCookie, {anycastEntryPoint: "aws-eu-west-1"})
      assert.calledOnceWithExactly(webex.internal.newMetrics.callDiagnosticLatencies.measureLatency, sinon.match.func, 'internal.get.cluster.time');
    });

    it('sends a POST request with the correct params when trigger is other than "startup"', async () => {
      const res = await reachabilityRequest.getClusters('early-call/no-min-reached', IP_VERSION.only_ipv4, previousReport);
      const requestParams = webex.request.getCall(0).args[0];

      assert.deepEqual(requestParams, {
        method: 'POST',
        resource: `clusters`,
        api: 'calliopeDiscovery',
        shouldRefreshAccessToken: false,
        timeout: 3000,
        body: {
          ipver: IP_VERSION.only_ipv4,
          'supported-options': {
            'report-version': 1,
            'early-call-min-clusters': true,
          },
          'previous-report': previousReport,
          trigger: 'early-call/no-min-reached',
        },
      });

      assert.deepEqual(res.clusters.clusterId, {udp: "testUDP", isVideoMesh: true})
      assert.deepEqual(res.joinCookie, {anycastEntryPoint: "aws-eu-west-1"})
      assert.notCalled(webex.internal.newMetrics.callDiagnosticLatencies.measureLatency);
    });
  });
});

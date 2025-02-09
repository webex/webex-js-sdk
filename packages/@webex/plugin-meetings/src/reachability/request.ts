import LoggerProxy from '../common/logs/logger-proxy';
import {HTTP_VERBS, RESOURCE, API, IP_VERSION} from '../constants';
import {GetClustersTrigger} from './reachability.types';

export interface ClusterNode {
  isVideoMesh: boolean;
  udp: Array<string>;
  tcp: Array<string>;
  xtls: Array<string>;
}

export type ClusterList = {
  [key: string]: ClusterNode;
};

/**
 * @class ReachabilityRequest
 */
class ReachabilityRequest {
  webex: any;

  /**
   * Creates an instance of ReachabilityRequest.
   * @param {object} webex
   * @memberof ReachabilityRequest
   */
  constructor(webex: object) {
    this.webex = webex;
  }

  /**
   * Gets the cluster information
   *
   * @param {string} trigger that's passed to Orpheus
   * @param {IP_VERSION} ipVersion information about current ip network we're on
   * @param {Object} previousReport last reachability result
   * @returns {Promise}
   */
  getClusters = (
    trigger: GetClustersTrigger,
    ipVersion?: IP_VERSION,
    previousReport?: any
  ): Promise<{
    clusters: ClusterList;
    joinCookie: any;
    discoveryOptions?: Record<string, any>;
  }> => {
    // we only measure latency for the initial startup call, not for other triggers
    const callWrapper =
      trigger === 'startup'
        ? this.webex.internal.newMetrics.callDiagnosticLatencies.measureLatency.bind(
            this.webex.internal.newMetrics.callDiagnosticLatencies
          )
        : (func) => func();

    return callWrapper(
      () =>
        this.webex.request({
          method: HTTP_VERBS.POST,
          shouldRefreshAccessToken: false,
          api: API.CALLIOPEDISCOVERY,
          resource: RESOURCE.CLUSTERS,
          body: {
            ipver: ipVersion,
            'supported-options': {
              'report-version': 1,
              'early-call-min-clusters': true,
            },
            'previous-report': previousReport,
            trigger,
          },
          timeout: this.webex.config.meetings.reachabilityGetClusterTimeout,
        }),
      'internal.get.cluster.time'
    ).then((res) => {
      const {clusters, joinCookie, discoveryOptions} = res.body;

      Object.keys(clusters).forEach((key) => {
        clusters[key].isVideoMesh = !!res.body.clusterClasses?.hybridMedia?.includes(key);
      });

      LoggerProxy.logger.log(
        `Reachability:request#getClusters --> get clusters (ipver=${ipVersion}) successful:${JSON.stringify(
          clusters
        )}`
      );

      return {
        clusters,
        joinCookie,
        discoveryOptions,
      };
    });
  };

  /**
   * gets remote SDP For Clusters
   * @param {Object} localSDPList localSDPs for the cluster
   * @returns {Object}
   */
  remoteSDPForClusters = (localSDPList: object) =>
    this.webex
      .request({
        method: HTTP_VERBS.POST,
        shouldRefreshAccessToken: false,
        api: API.CALLIOPEDISCOVERY,
        resource: RESOURCE.REACHABILITY,
        body: {offers: localSDPList},
      })
      .then((res) => {
        LoggerProxy.logger.log(
          'Reachability:request#remoteSDPForClusters --> Remote SDPs got succcessfully'
        );

        return res.body;
      });
}

export default ReachabilityRequest;

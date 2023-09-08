import LoggerProxy from '../common/logs/logger-proxy';
import {HTTP_VERBS, RESOURCE, API} from '../constants';

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
   * @returns {Promise}
   */
  getClusters = (): Promise<{clusters: ClusterList; joinCookie: any}> =>
    this.webex
      .request({
        method: HTTP_VERBS.GET,
        shouldRefreshAccessToken: false,
        api: API.CALLIOPEDISCOVERY,
        resource: RESOURCE.CLUSTERS,
        qs: {
          JCSupport: 1,
        },
      })
      .then((res) => {
        const {clusters, joinCookie} = res.body;

        Object.keys(clusters).forEach((key) => {
          clusters[key].isVideoMesh = res.body.clusterClasses?.hybridMedia?.includes(key);
        });

        LoggerProxy.logger.log(
          `Reachability:request#getClusters --> get clusters successful:${JSON.stringify(clusters)}`
        );

        return {
          clusters,
          joinCookie,
        };
      });

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

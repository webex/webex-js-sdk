import LoggerProxy from '../common/logs/logger-proxy';
import {
  HTTP_VERBS,
  RESOURCE,
  API
} from '../constants';

/**
 * @class RechabilityRequest
 */
class RechabilityRequest {
  /**
   * Creates an instance of RechabilityRequest.
   * @param {object} webex
   * @memberof RechabilityRequest
   */
  constructor(webex) {
    this.webex = webex;
  }

  /**
   * gets the cluster information
   * @returns {Promise}
   */
  getClusters = () => this.webex.request({
    method: HTTP_VERBS.GET,
    shouldRefreshAccessToken: false,
    api: API.CALLIOPEDISCOVERY,
    resource: RESOURCE.CLUSTERS
  })
    .then((res) => {
      const {clusters} = res.body;

      LoggerProxy.logger.log(`Reachability:request#getClusters --> get clusters successful:${JSON.stringify(clusters)}`);

      return clusters;
    });

  /**
   * gets remote SDP For Clusters
   * @param {Object} localSDPList localSDPs for the cluster
   * @returns {Object}
   */
  remoteSDPForClusters = (localSDPList) => this.webex.request({
    method: HTTP_VERBS.POST,
    shouldRefreshAccessToken: false,
    api: API.CALLIOPEDISCOVERY,
    resource: RESOURCE.REACHABILITY,
    body: {offers: localSDPList}
  })
    .then((res) => {
      LoggerProxy.logger.log('Reachability:request#remoteSDPForClusters --> Remote SDPs got succcessfully');

      return res.body;
    });
}

export default RechabilityRequest;

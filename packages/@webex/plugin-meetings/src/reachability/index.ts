/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable class-methods-use-this */
import {mapValues, pick} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';
import MeetingUtil from '../meeting/util';

import {REACHABILITY} from '../constants';

import ReachabilityRequest, {ClusterList} from './request';
import {ClusterReachability, ReachabilityResult} from './clusterReachability';

export type ReachabilityMetrics = {
  reachability_public_udp_success: number;
  reachability_public_udp_failed: number;
  reachability_public_tcp_success: number;
  reachability_public_tcp_failed: number;
  reachability_vmn_udp_success: number;
  reachability_vmn_udp_failed: number;
  reachability_vmn_tcp_success: number;
  reachability_vmn_tcp_failed: number;
};

// this is the type that is required by the backend when we send them reachability results
export type ReachabilityResults = Record<string, ReachabilityResult>;

// this is the type used by Reachability class internally and stored in local storage
type InternalReachabilityResults = Record<
  string,
  ReachabilityResult & {
    isVideoMesh?: boolean;
  }
>;

/**
 * @class Reachability
 * @export
 */
export default class Reachability {
  namespace = REACHABILITY.namespace;
  webex: object;
  reachabilityRequest: ReachabilityRequest;
  clusterReachability: {
    [key: string]: ClusterReachability;
  };

  /**
   * Creates an instance of Reachability.
   * @param {object} webex
   * @memberof Reachability
   */
  constructor(webex: object) {
    this.webex = webex;

    /**
     * internal request object for the server
     * @instance
     * @type {Array}
     * @private
     * @memberof Reachability
     */
    this.reachabilityRequest = new ReachabilityRequest(this.webex);
  }

  /**
   * fetches reachability data
   * @returns {Object} reachability data
   * @public
   * @async
   * @memberof Reachability
   */
  public async gatherReachability(): Promise<InternalReachabilityResults> {
    // Remove stored reachability results to ensure no stale data
    // @ts-ignore
    await this.webex.boundedStorage.del(this.namespace, REACHABILITY.localStorageResult);
    // @ts-ignore
    await this.webex.boundedStorage.del(this.namespace, REACHABILITY.localStorageJoinCookie);

    // Fetch clusters and measure latency
    try {
      const {clusters, joinCookie} = await this.reachabilityRequest.getClusters(
        MeetingUtil.getIpVersion(this.webex)
      );

      // Perform Reachability Check
      const results = await this.performReachabilityChecks(clusters);

      // @ts-ignore
      await this.webex.boundedStorage.put(
        this.namespace,
        REACHABILITY.localStorageResult,
        JSON.stringify(results)
      );
      // @ts-ignore
      await this.webex.boundedStorage.put(
        this.namespace,
        REACHABILITY.localStorageJoinCookie,
        JSON.stringify(joinCookie)
      );

      LoggerProxy.logger.log(
        'Reachability:index#gatherReachability --> Reachability checks completed'
      );

      return results;
    } catch (getClusterError) {
      LoggerProxy.logger.error(
        `Reachability:index#gatherReachability --> Error in calling getClusters(): ${getClusterError}`
      );

      return {};
    }
  }

  /**
   * Returns statistics about last reachability results. The returned value is an object
   * with a flat list of properties so that it can be easily sent with metrics
   *
   * @returns {Promise} Promise with metrics values, it never rejects/throws.
   */
  async getReachabilityMetrics(): Promise<ReachabilityMetrics> {
    const stats: ReachabilityMetrics = {
      reachability_public_udp_success: 0,
      reachability_public_udp_failed: 0,
      reachability_public_tcp_success: 0,
      reachability_public_tcp_failed: 0,
      reachability_vmn_udp_success: 0,
      reachability_vmn_udp_failed: 0,
      reachability_vmn_tcp_success: 0,
      reachability_vmn_tcp_failed: 0,
    };

    const updateStats = (clusterType: 'public' | 'vmn', result: ReachabilityResult) => {
      if (result.udp?.reachable) {
        const outcome = result.udp.reachable === 'true' ? 'success' : 'failed';
        stats[`reachability_${clusterType}_udp_${outcome}`] += 1;
      }
      if (result.tcp?.reachable) {
        const outcome = result.tcp.reachable === 'true' ? 'success' : 'failed';
        stats[`reachability_${clusterType}_tcp_${outcome}`] += 1;
      }
    };

    try {
      // @ts-ignore
      const resultsJson = await this.webex.boundedStorage.get(
        REACHABILITY.namespace,
        REACHABILITY.localStorageResult
      );

      const internalResults: InternalReachabilityResults = JSON.parse(resultsJson);

      Object.values(internalResults).forEach((result) => {
        updateStats(result.isVideoMesh ? 'vmn' : 'public', result);
      });
    } catch (e) {
      // empty storage, that's ok
      LoggerProxy.logger.warn(
        'Roap:request#getReachabilityMetrics --> Error parsing reachability data: ',
        e
      );
    }

    return stats;
  }

  /**
   * Reachability results as an object in the format that backend expects
   *
   * @returns {any} reachability results that need to be sent to the backend
   */
  async getReachabilityResults(): Promise<ReachabilityResults | undefined> {
    let results: ReachabilityResults;

    // these are the only props that backend needs in the reachability results:
    const reachabilityResultsProps: Array<keyof ReachabilityResult> = ['udp', 'tcp', 'xtls'];

    try {
      // @ts-ignore
      const resultsJson = await this.webex.boundedStorage.get(
        REACHABILITY.namespace,
        REACHABILITY.localStorageResult
      );

      const internalResults: InternalReachabilityResults = JSON.parse(resultsJson);

      results = mapValues(internalResults, (result) => pick(result, reachabilityResultsProps));
    } catch (e) {
      // empty storage, that's ok
      LoggerProxy.logger.warn(
        'Roap:request#attachReachabilityData --> Error parsing reachability data: ',
        e
      );
    }

    return results;
  }

  /**
   * fetches reachability data and checks for cluster reachability
   * @returns {boolean}
   * @public
   * @memberof Reachability
   */
  async isAnyPublicClusterReachable() {
    let reachable = false;
    // @ts-ignore
    const reachabilityData = await this.webex.boundedStorage
      .get(this.namespace, REACHABILITY.localStorageResult)
      .catch(() => {});

    if (reachabilityData) {
      try {
        const reachabilityResults: InternalReachabilityResults = JSON.parse(reachabilityData);

        reachable = Object.values(reachabilityResults).some(
          (result) =>
            !result.isVideoMesh &&
            (result.udp?.reachable === 'true' || result.tcp?.reachable === 'true')
        );
      } catch (e) {
        LoggerProxy.logger.error(
          `Roap:request#attachReachabilityData --> Error in parsing reachability data: ${e}`
        );
      }
    }

    return reachable;
  }

  /**
   * Get list of all unreachable clusters
   * @returns {array} Unreachable clusters
   * @private
   * @memberof Reachability
   */
  private getUnreachablClusters(): Array<{name: string; protocol: string}> {
    const unreachableList = [];

    Object.entries(this.clusterReachability).forEach(([key, clusterReachability]) => {
      if (clusterReachability.isUnreachable('udp')) {
        unreachableList.push({name: key, protocol: 'udp'});
      }
      if (clusterReachability.isUnreachable('tcp')) {
        unreachableList.push({name: key, protocol: 'tcp'});
      }
    });

    return unreachableList;
  }

  /**
   * Make a log of unreachable clusters.
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  private logUnreachableClusters() {
    const list = this.getUnreachablClusters();

    list.forEach(({name, protocol}) => {
      LoggerProxy.logger.log(
        `Reachability:index#logUnreachableClusters --> No ice candidate for ${name} over ${protocol}.`
      );
    });
  }

  /**
   * Performs reachability checks for all clusters
   * @param {ClusterList} clusterList
   * @returns {Promise<InternalReachabilityResults>} reachability check results
   */
  private async performReachabilityChecks(
    clusterList: ClusterList
  ): Promise<InternalReachabilityResults> {
    const results: InternalReachabilityResults = {};

    if (!clusterList || !Object.keys(clusterList).length) {
      return Promise.resolve(results);
    }

    const clusterReachabilityChecks = Object.keys(clusterList).map((key) => {
      const cluster = clusterList[key];

      this.clusterReachability[key] = new ClusterReachability(key, cluster);

      return this.clusterReachability[key].start().then((result) => {
        results[key] = result;
        results[key].isVideoMesh = cluster.isVideoMesh;
      });
    });

    await Promise.all(clusterReachabilityChecks);

    this.logUnreachableClusters();

    return results;
  }
}

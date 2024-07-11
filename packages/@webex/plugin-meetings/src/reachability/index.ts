/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable class-methods-use-this */
import {mapValues} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';
import MeetingUtil from '../meeting/util';

import {REACHABILITY} from '../constants';

import ReachabilityRequest, {ClusterList} from './request';
import {
  ClusterReachability,
  ClusterReachabilityResult,
  TransportResult,
} from './clusterReachability';

export type ReachabilityMetrics = {
  reachability_public_udp_success: number;
  reachability_public_udp_failed: number;
  reachability_public_tcp_success: number;
  reachability_public_tcp_failed: number;
  reachability_public_xtls_success: number;
  reachability_public_xtls_failed: number;
  reachability_vmn_udp_success: number;
  reachability_vmn_udp_failed: number;
  reachability_vmn_tcp_success: number;
  reachability_vmn_tcp_failed: number;
  reachability_vmn_xtls_success: number;
  reachability_vmn_xtls_failed: number;
};

/**
 * This is the type that matches what backend expects us to send to them. It is a bit weird, because
 * it uses strings instead of booleans and numbers, but that's what they require.
 */
export type TransportResultForBackend = {
  reachable?: 'true' | 'false';
  latencyInMilliseconds?: string;
  clientMediaIPs?: string[];
  untested?: 'true';
};

export type ReachabilityResultForBackend = {
  udp: TransportResultForBackend;
  tcp: TransportResultForBackend;
  xtls: TransportResultForBackend;
};

// this is the type that is required by the backend when we send them reachability results
export type ReachabilityResultsForBackend = Record<string, ReachabilityResultForBackend>;

// this is the type used by Reachability class internally and stored in local storage
export type ReachabilityResults = Record<
  string,
  ClusterReachabilityResult & {
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

    this.clusterReachability = {};
  }

  /**
   * Maps our internal transport result to the format that backend expects
   * @param {TransportResult} transportResult
   * @returns {TransportResultForBackend}
   */
  private mapTransportResultToBackendDataFormat(
    transportResult: TransportResult
  ): TransportResultForBackend {
    const output: TransportResultForBackend = {};

    for (const [key, value] of Object.entries(transportResult)) {
      switch (key) {
        case 'result':
          switch (value) {
            case 'reachable':
              output.reachable = 'true';
              break;
            case 'unreachable':
              output.reachable = 'false';
              break;
            case 'untested':
              output.untested = 'true';
              break;
          }
          break;
        case 'latencyInMilliseconds':
          output.latencyInMilliseconds = value.toString();
          break;
        default:
          output[key as keyof TransportResultForBackend] = value as any;
      }
    }

    return output;
  }

  /**
   * Gets a list of media clusters from the backend and performs reachability checks on all the clusters
   * @returns {Promise<ReachabilityResults>} reachability results
   * @public
   * @memberof Reachability
   */
  public async gatherReachability(): Promise<ReachabilityResults> {
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
    } catch (error) {
      LoggerProxy.logger.error(`Reachability:index#gatherReachability --> Error:`, error);

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
      reachability_public_xtls_success: 0,
      reachability_public_xtls_failed: 0,
      reachability_vmn_udp_success: 0,
      reachability_vmn_udp_failed: 0,
      reachability_vmn_tcp_success: 0,
      reachability_vmn_tcp_failed: 0,
      reachability_vmn_xtls_success: 0,
      reachability_vmn_xtls_failed: 0,
    };

    const updateStats = (clusterType: 'public' | 'vmn', result: ClusterReachabilityResult) => {
      if (result.udp && result.udp.result !== 'untested') {
        const outcome = result.udp.result === 'reachable' ? 'success' : 'failed';
        stats[`reachability_${clusterType}_udp_${outcome}`] += 1;
      }
      if (result.tcp && result.tcp.result !== 'untested') {
        const outcome = result.tcp.result === 'reachable' ? 'success' : 'failed';
        stats[`reachability_${clusterType}_tcp_${outcome}`] += 1;
      }
      if (result.xtls && result.xtls.result !== 'untested') {
        const outcome = result.xtls.result === 'reachable' ? 'success' : 'failed';
        stats[`reachability_${clusterType}_xtls_${outcome}`] += 1;
      }
    };

    try {
      // @ts-ignore
      const resultsJson = await this.webex.boundedStorage.get(
        REACHABILITY.namespace,
        REACHABILITY.localStorageResult
      );

      const results: ReachabilityResults = JSON.parse(resultsJson);

      Object.values(results).forEach((result) => {
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
  async getReachabilityResults(): Promise<ReachabilityResultsForBackend | undefined> {
    let results: ReachabilityResultsForBackend | undefined;

    try {
      // @ts-ignore
      const resultsJson = await this.webex.boundedStorage.get(
        REACHABILITY.namespace,
        REACHABILITY.localStorageResult
      );

      const allClusterResults: ReachabilityResults = JSON.parse(resultsJson);

      results = mapValues(allClusterResults, (clusterResult) => ({
        udp: this.mapTransportResultToBackendDataFormat(clusterResult.udp || {result: 'untested'}),
        tcp: this.mapTransportResultToBackendDataFormat(clusterResult.tcp || {result: 'untested'}),
        xtls: this.mapTransportResultToBackendDataFormat(
          clusterResult.xtls || {result: 'untested'}
        ),
      }));
    } catch (e: unknown) {
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
        const reachabilityResults: ReachabilityResults = JSON.parse(reachabilityData);

        reachable = Object.values(reachabilityResults).some(
          (result) =>
            !result.isVideoMesh &&
            (result.udp?.result === 'reachable' || result.tcp?.result === 'reachable')
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
   * Returns true only if ALL protocols (UDP, TCP and TLS) have been tested and none
   * of the media clusters where reachable with any of the protocols. This is done
   * irrespective of the config, so for example:
   * if config.meetings.experimental.enableTlsReachability === false,
   * it will return false, because TLS reachability won't be tested,
   * so we can't say for sure that media backend is unreachable over TLS.
   *
   * @returns {boolean}
   */
  async isWebexMediaBackendUnreachable() {
    let unreachable = false;

    // @ts-ignore
    const reachabilityData = await this.webex.boundedStorage
      .get(this.namespace, REACHABILITY.localStorageResult)
      .catch(() => {});

    if (reachabilityData) {
      try {
        const reachabilityResults: ReachabilityResults = JSON.parse(reachabilityData);

        const protocols = {
          udp: {tested: false, reachable: undefined},
          tcp: {tested: false, reachable: undefined},
          xtls: {tested: false, reachable: undefined},
        };

        Object.values(reachabilityResults).forEach((result) => {
          Object.keys(protocols).forEach((protocol) => {
            if (
              result[protocol]?.result === 'reachable' ||
              result[protocol]?.result === 'unreachable'
            ) {
              protocols[protocol].tested = true;

              // we need at least 1 'reachable' result to mark the whole protocol as reachable
              if (result[protocol].result === 'reachable') {
                protocols[protocol].reachable = true;
              }
            }
          });
        });

        unreachable = Object.values(protocols).every(
          (protocol) => protocol.tested && !protocol.reachable
        );
      } catch (e) {
        LoggerProxy.logger.error(
          `Roap:request#attachReachabilityData --> Error in parsing reachability data: ${e}`
        );
      }
    }

    return unreachable;
  }

  /**
   * Get list of all unreachable clusters
   * @returns {array} Unreachable clusters
   * @private
   * @memberof Reachability
   */
  private getUnreachableClusters(): {name: string; protocol: string}[] {
    const unreachableList: {name: string; protocol: string}[] = [];

    Object.entries(this.clusterReachability).forEach(([key, clusterReachability]) => {
      const result = clusterReachability.getResult();

      if (result.udp.result === 'unreachable') {
        unreachableList.push({name: key, protocol: 'udp'});
      }
      if (result.tcp.result === 'unreachable') {
        unreachableList.push({name: key, protocol: 'tcp'});
      }
      if (result.xtls.result === 'unreachable') {
        unreachableList.push({name: key, protocol: 'xtls'});
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
    const list = this.getUnreachableClusters();

    list.forEach(({name, protocol}) => {
      LoggerProxy.logger.log(
        `Reachability:index#logUnreachableClusters --> failed to reach ${name} over ${protocol}`
      );
    });
  }

  /**
   * Performs reachability checks for all clusters
   * @param {ClusterList} clusterList
   * @returns {Promise<ReachabilityResults>} reachability check results
   */
  private async performReachabilityChecks(clusterList: ClusterList): Promise<ReachabilityResults> {
    const results: ReachabilityResults = {};

    if (!clusterList || !Object.keys(clusterList).length) {
      return Promise.resolve(results);
    }

    LoggerProxy.logger.log(
      `Reachability:index#performReachabilityChecks --> doing UDP${
        // @ts-ignore
        this.webex.config.meetings.experimental.enableTcpReachability ? ',TCP' : ''
      }${
        // @ts-ignore
        this.webex.config.meetings.experimental.enableTlsReachability ? ',TLS' : ''
      } reachability checks`
    );

    const clusterReachabilityChecks = Object.keys(clusterList).map((key) => {
      const cluster = clusterList[key];

      // Linus doesn't support TCP reachability checks on video mesh nodes
      const includeTcpReachability =
        // @ts-ignore
        this.webex.config.meetings.experimental.enableTcpReachability && !cluster.isVideoMesh;

      if (!includeTcpReachability) {
        cluster.tcp = [];
      }

      const includeTlsReachability =
        // @ts-ignore
        this.webex.config.meetings.experimental.enableTlsReachability && !cluster.isVideoMesh;

      if (!includeTlsReachability) {
        cluster.xtls = [];
      }

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

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable class-methods-use-this */
import {isEqual, mapValues, mean} from 'lodash';

import {Defer} from '@webex/common';
import LoggerProxy from '../common/logs/logger-proxy';
import MeetingUtil from '../meeting/util';

import {REACHABILITY} from '../constants';

import ReachabilityRequest, {ClusterList} from './request';
import {
  ClientMediaIpsUpdatedEventData,
  ClusterReachability,
  ClusterReachabilityResult,
  Events,
  ResultEventData,
  TransportResult,
} from './clusterReachability';
import EventsScope from '../common/events/events-scope';
import BEHAVIORAL_METRICS from '../metrics/constants';
import Metrics from '../metrics';

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

// timeouts in seconds
const DEFAULT_TIMEOUT = 3;
const VIDEO_MESH_TIMEOUT = 1;
const OVERALL_TIMEOUT = 15;

/**
 * @class Reachability
 * @export
 */
export default class Reachability extends EventsScope {
  namespace = REACHABILITY.namespace;
  webex: object;
  reachabilityRequest: ReachabilityRequest;
  clusterReachability: {
    [key: string]: ClusterReachability;
  };

  reachabilityDefer?: Defer;

  vmnTimer?: ReturnType<typeof setTimeout>;
  publicCloudTimer?: ReturnType<typeof setTimeout>;
  overallTimer?: ReturnType<typeof setTimeout>;

  expectedResultsCount = {videoMesh: {udp: 0}, public: {udp: 0, tcp: 0, xtls: 0}};
  resultsCount = {videoMesh: {udp: 0}, public: {udp: 0, tcp: 0, xtls: 0}};

  /**
   * Creates an instance of Reachability.
   * @param {object} webex
   * @memberof Reachability
   */
  constructor(webex: object) {
    super();
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
   * Fetches the list of media clusters from the backend
   * @param {boolean} isRetry
   * @private
   * @returns {Promise<{clusters: ClusterList, joinCookie: any}>}
   */
  async getClusters(isRetry = false): Promise<{clusters: ClusterList; joinCookie: any}> {
    try {
      const {clusters, joinCookie} = await this.reachabilityRequest.getClusters(
        MeetingUtil.getIpVersion(this.webex)
      );

      return {clusters, joinCookie};
    } catch (error) {
      if (isRetry) {
        throw error;
      }

      LoggerProxy.logger.error(
        `Reachability:index#getClusters --> Failed with error: ${error}, retrying...`
      );

      return this.getClusters(true);
    }
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
      const {clusters, joinCookie} = await this.getClusters();

      // @ts-ignore
      await this.webex.boundedStorage.put(
        this.namespace,
        REACHABILITY.localStorageJoinCookie,
        JSON.stringify(joinCookie)
      );

      this.reachabilityDefer = new Defer();

      // Perform Reachability Check
      await this.performReachabilityChecks(clusters);

      return this.reachabilityDefer.promise;
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
          output[key] = value;
      }
    }

    return output;
  }

  /**
   * Reachability results as an object in the format that backend expects
   *
   * @returns {any} reachability results that need to be sent to the backend
   */
  async getReachabilityResults(): Promise<ReachabilityResultsForBackend | undefined> {
    let results: ReachabilityResultsForBackend;

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
  private getUnreachableClusters(): Array<{name: string; protocol: string}> {
    const unreachableList = [];

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
   * Returns true if we've obtained all the reachability results for all the public clusters
   * In other words, it means that all public clusters are reachable over each protocol,
   * because we only get a "result" if we managed to reach a cluster
   *
   * @returns {boolean}
   */
  private areAllPublicClusterResultsReady() {
    return isEqual(this.expectedResultsCount.public, this.resultsCount.public);
  }

  /**
   * Returns true if we've obtained all the reachability results for all the clusters
   *
   * @returns {boolean}
   */
  private areAllResultsReady() {
    return isEqual(this.expectedResultsCount, this.resultsCount);
  }

  /**
   * Resolves the promise returned by gatherReachability() method
   * @returns {void}
   */
  private resolveReachabilityPromise() {
    if (this.vmnTimer) {
      clearTimeout(this.vmnTimer);
    }
    if (this.publicCloudTimer) {
      clearTimeout(this.publicCloudTimer);
    }

    this.logUnreachableClusters();
    this.reachabilityDefer?.resolve();
  }

  /**
   * Aborts all cluster reachability checks that are in progress
   *
   * @returns {void}
   */
  private abortClusterReachability() {
    Object.values(this.clusterReachability).forEach((clusterReachability) => {
      clusterReachability.abort();
    });
  }

  /**
   * Helper function for calculating min/max/average values of latency
   *
   * @param {Array<any>} results
   * @param {string} protocol
   * @param {boolean} isVideoMesh
   * @returns {{min:number, max: number, average: number}}
   */
  protected getStatistics(
    results: Array<ClusterReachabilityResult & {isVideoMesh: boolean}>,
    protocol: 'udp' | 'tcp' | 'xtls',
    isVideoMesh: boolean
  ) {
    const values = results
      .filter((result) => result.isVideoMesh === isVideoMesh)
      .filter((result) => result[protocol].result === 'reachable')
      .map((result) => result[protocol].latencyInMilliseconds);

    if (values.length === 0) {
      return {
        min: -1,
        max: -1,
        average: -1,
      };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      average: mean(values),
    };
  }

  /**
   * Sends a metric with all the statistics about how long reachability took
   *
   * @returns {void}
   */
  protected async sendMetric() {
    const results = [];

    Object.values(this.clusterReachability).forEach((clusterReachability) => {
      results.push({
        ...clusterReachability.getResult(),
        isVideoMesh: clusterReachability.isVideoMesh,
      });
    });

    const stats = {
      vmn: {
        udp: this.getStatistics(results, 'udp', true),
      },
      public: {
        udp: this.getStatistics(results, 'udp', false),
        tcp: this.getStatistics(results, 'tcp', false),
        xtls: this.getStatistics(results, 'xtls', false),
      },
    };
    Metrics.sendBehavioralMetric(
      BEHAVIORAL_METRICS.REACHABILITY_COMPLETED,
      Metrics.prepareMetricFields(stats)
    );
  }

  /**
   * Starts all the timers used for various timeouts
   *
   * @returns {void}
   */
  private startTimers() {
    this.vmnTimer = setTimeout(() => {
      this.vmnTimer = undefined;
      // if we are only missing VMN results, then we don't want to wait for them any longer
      // as they are likely to fail if users are not on corporate network
      if (this.areAllPublicClusterResultsReady()) {
        LoggerProxy.logger.log(
          'Reachability:index#startTimers --> Reachability checks timed out (VMN timeout)'
        );

        this.resolveReachabilityPromise();
      }
    }, VIDEO_MESH_TIMEOUT * 1000);

    this.publicCloudTimer = setTimeout(() => {
      this.publicCloudTimer = undefined;

      LoggerProxy.logger.log(
        `Reachability:index#startTimers --> Reachability checks timed out (${DEFAULT_TIMEOUT}s)`
      );

      // resolve the promise, so that the client won't be blocked waiting on meetings.register() for too long
      this.resolveReachabilityPromise();
    }, DEFAULT_TIMEOUT * 1000);

    this.overallTimer = setTimeout(() => {
      this.overallTimer = undefined;
      this.abortClusterReachability();
      this.emit(
        {
          file: 'reachability',
          function: 'overallTimer timeout',
        },
        'reachability:done',
        {}
      );
      this.sendMetric();

      LoggerProxy.logger.log(
        `Reachability:index#startTimers --> Reachability checks fully timed out (${OVERALL_TIMEOUT}s)`
      );
    }, OVERALL_TIMEOUT * 1000);
  }

  /**
   * Stores given reachability results in local storage
   *
   * @param {ReachabilityResults} results
   * @returns {Promise<void>}
   */
  private async storeResults(results: ReachabilityResults) {
    // @ts-ignore
    await this.webex.boundedStorage.put(
      this.namespace,
      REACHABILITY.localStorageResult,
      JSON.stringify(results)
    );
  }

  /**
   * Resets all the internal counters that keep track of the results
   *
   * @returns {void}
   */
  private resetResultCounters() {
    this.expectedResultsCount.videoMesh.udp = 0;
    this.expectedResultsCount.public.udp = 0;
    this.expectedResultsCount.public.tcp = 0;
    this.expectedResultsCount.public.xtls = 0;

    this.resultsCount.videoMesh.udp = 0;
    this.resultsCount.public.udp = 0;
    this.resultsCount.public.tcp = 0;
    this.resultsCount.public.xtls = 0;
  }

  /**
   * Performs reachability checks for all clusters
   * @param {ClusterList} clusterList
   * @returns {Promise<void>} promise that's resolved as soon as the checks are started
   */
  private async performReachabilityChecks(clusterList: ClusterList) {
    const results: ReachabilityResults = {};

    this.clusterReachability = {};

    if (!clusterList || !Object.keys(clusterList).length) {
      return;
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

    this.resetResultCounters();
    this.startTimers();

    // sanitize the urls in the clusterList
    Object.keys(clusterList).forEach((key) => {
      const cluster = clusterList[key];

      // Linus doesn't support TCP reachability checks on video mesh nodes
      const includeTcpReachability =
        // @ts-ignore
        this.webex.config.meetings.experimental.enableTcpReachability && !cluster.isVideoMesh;

      if (!includeTcpReachability) {
        cluster.tcp = [];
      }

      // Linus doesn't support xTLS reachability checks on video mesh nodes
      const includeTlsReachability =
        // @ts-ignore
        this.webex.config.meetings.experimental.enableTlsReachability && !cluster.isVideoMesh;

      if (!includeTlsReachability) {
        cluster.xtls = [];
      }

      // initialize the result for this cluster
      results[key] = {
        udp: {result: cluster.udp.length > 0 ? 'unreachable' : 'untested'},
        tcp: {result: cluster.tcp.length > 0 ? 'unreachable' : 'untested'},
        xtls: {result: cluster.xtls.length > 0 ? 'unreachable' : 'untested'},
        isVideoMesh: cluster.isVideoMesh,
      };

      // update expected results counters to include this cluster
      this.expectedResultsCount[cluster.isVideoMesh ? 'videoMesh' : 'public'].udp +=
        cluster.udp.length;
      if (!cluster.isVideoMesh) {
        this.expectedResultsCount.public.tcp += cluster.tcp.length;
        this.expectedResultsCount.public.xtls += cluster.xtls.length;
      }
    });

    const isFirstResult = {
      udp: true,
      tcp: true,
      xtls: true,
    };

    // save the initialized results (in case we don't get any "resultReady" events at all)
    await this.storeResults(results);

    // now start the reachability on all the clusters
    Object.keys(clusterList).forEach((key) => {
      const cluster = clusterList[key];

      this.clusterReachability[key] = new ClusterReachability(key, cluster);
      this.clusterReachability[key].on(Events.resultReady, async (data: ResultEventData) => {
        const {protocol, result, clientMediaIPs, latencyInMilliseconds} = data;

        if (isFirstResult[protocol]) {
          this.emit(
            {
              file: 'reachability',
              function: 'resultReady event handler',
            },
            'reachability:firstResultAvailable',
            {
              protocol,
            }
          );
          isFirstResult[protocol] = false;
        }
        this.resultsCount[cluster.isVideoMesh ? 'videoMesh' : 'public'][protocol] += 1;

        const areAllResultsReady = this.areAllResultsReady();

        results[key][protocol].result = result;
        results[key][protocol].clientMediaIPs = clientMediaIPs;
        results[key][protocol].latencyInMilliseconds = latencyInMilliseconds;

        await this.storeResults(results);

        if (areAllResultsReady) {
          clearTimeout(this.overallTimer);
          this.overallTimer = undefined;
          this.emit(
            {
              file: 'reachability',
              function: 'performReachabilityChecks',
            },
            'reachability:done',
            {}
          );
          this.sendMetric();

          LoggerProxy.logger.log(
            `Reachability:index#gatherReachability --> Reachability checks fully completed`
          );
          this.resolveReachabilityPromise();
        }
      });

      // clientMediaIps can be updated independently from the results, so we need to listen for them too
      this.clusterReachability[key].on(
        Events.clientMediaIpsUpdated,
        async (data: ClientMediaIpsUpdatedEventData) => {
          results[key][data.protocol].clientMediaIPs = data.clientMediaIPs;

          await this.storeResults(results);
        }
      );

      this.clusterReachability[key].start(); // not awaiting on purpose
    });
  }
}

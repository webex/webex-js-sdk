/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable class-methods-use-this */
import {isEqual, mapValues, mean} from 'lodash';

import {Defer} from '@webex/common';
import LoggerProxy from '../common/logs/logger-proxy';
import MeetingUtil from '../meeting/util';

import {IP_VERSION, REACHABILITY} from '../constants';

import ReachabilityRequest, {ClusterList} from './request';
import {
  ClusterReachabilityResult,
  TransportResult,
  ClientMediaPreferences,
  ReachabilityMetrics,
  ReachabilityReportV0,
  ReachabilityReportV1,
  ReachabilityResults,
  ReachabilityResultsForBackend,
  TransportResultForBackend,
  GetClustersTrigger,
} from './reachability.types';
import {
  ClientMediaIpsUpdatedEventData,
  ClusterReachability,
  Events,
  ResultEventData,
} from './clusterReachability';
import EventsScope from '../common/events/events-scope';
import BEHAVIORAL_METRICS from '../metrics/constants';
import Metrics from '../metrics';

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

  minRequiredClusters?: number;
  orpheusApiVersion?: number;

  reachabilityDefer?: Defer;

  vmnTimer?: ReturnType<typeof setTimeout>;
  publicCloudTimer?: ReturnType<typeof setTimeout>;
  overallTimer?: ReturnType<typeof setTimeout>;

  expectedResultsCount = {videoMesh: {udp: 0}, public: {udp: 0, tcp: 0, xtls: 0}};
  resultsCount = {videoMesh: {udp: 0}, public: {udp: 0, tcp: 0, xtls: 0}};
  startTime = undefined;
  totalDuration = undefined;

  protected lastTrigger?: string;

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
   * @param {string} trigger - explains the reason for starting reachability, used by Orpheus
   * @param {Object} previousReport - last reachability report
   * @param {boolean} isRetry
   * @private
   * @returns {Promise<{clusters: ClusterList, joinCookie: any}>}
   */
  async getClusters(
    trigger: GetClustersTrigger,
    previousReport?: any,
    isRetry = false
  ): Promise<{
    clusters: ClusterList;
    joinCookie: any;
  }> {
    try {
      const {clusters, joinCookie, discoveryOptions} = await this.reachabilityRequest.getClusters(
        trigger,
        MeetingUtil.getIpVersion(this.webex),
        previousReport
      );

      this.minRequiredClusters = discoveryOptions?.['early-call-min-clusters'];
      this.orpheusApiVersion = discoveryOptions?.['report-version'];

      // @ts-ignore
      await this.webex.boundedStorage.put(
        this.namespace,
        REACHABILITY.localStorageJoinCookie,
        JSON.stringify(joinCookie)
      );

      return {clusters, joinCookie};
    } catch (error) {
      if (isRetry) {
        throw error;
      }

      LoggerProxy.logger.error(
        `Reachability:index#getClusters --> Failed with error: ${error}, retrying...`
      );

      return this.getClusters(trigger, previousReport, true);
    }
  }

  /**
   * Gets a list of media clusters from the backend and performs reachability checks on all the clusters
   * @param {string} trigger - explains the reason for starting reachability
   * @returns {Promise<ReachabilityResults>} reachability results
   * @public
   * @memberof Reachability
   */
  public async gatherReachability(trigger: string): Promise<ReachabilityResults> {
    // Fetch clusters and measure latency
    try {
      this.lastTrigger = trigger;

      // kick off ip version detection. We don't await it, as we don't want to waste time
      // and if it fails, that's ok we can still carry on
      // @ts-ignore
      this.webex.internal.device.ipNetworkDetector.detect(true);

      const {clusters} = await this.getClusters('startup');

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
   * Gets the last join cookie we got from Orpheus
   *
   * @returns {Promise<Object>} join cookie
   */
  async getJoinCookie() {
    // @ts-ignore
    const joinCookieRaw = await this.webex.boundedStorage
      .get(REACHABILITY.namespace, REACHABILITY.localStorageJoinCookie)
      .catch(() => {});

    let joinCookie;

    if (joinCookieRaw) {
      try {
        joinCookie = JSON.parse(joinCookieRaw);
      } catch (e) {
        LoggerProxy.logger.error(
          `MeetingRequest#constructor --> Error in parsing join cookie data: ${e}`
        );
      }
    }

    return joinCookie;
  }

  /**
   * Returns the reachability report that needs to be attached to the ROAP messages
   * that we send to the backend.
   *
   * @returns {Promise<Object>}
   */
  async getReachabilityReport(): Promise<
    | {
        joinCookie: any;
        reachability?: ReachabilityReportV1;
      }
    | {
        reachability: ReachabilityReportV0;
      }
  > {
    const reachabilityResult = await this.getReachabilityResults();
    const joinCookie = await this.getJoinCookie();

    // Orpheus API version 0
    if (!this.orpheusApiVersion) {
      return {
        reachability: reachabilityResult,
      };
    }

    // Orpheus API version 1
    return {
      reachability: {
        version: 1,
        result: {
          usedDiscoveryOptions: {
            'early-call-min-clusters': this.minRequiredClusters,
          },
          metrics: {
            'total-duration-ms': this.totalDuration,
          },
          tests: reachabilityResult,
        },
      },
      joinCookie,
    };
  }

  /**
   * This method is called when we don't succeed in reaching the minimum number of clusters
   * required by Orpheus. It sends the results to Orpheus and gets a new list that it tries to reach again.
   * @returns {Promise<ReachabilityResults>} reachability results
   * @public
   * @memberof Reachability
   */
  public async gatherReachabilityFallback(): Promise<void> {
    try {
      const reachabilityReport = await this.getReachabilityReport();

      const {clusters} = await this.getClusters('early-call/no-min-reached', reachabilityReport);

      // stop all previous reachability checks that might still be going on in the background
      this.abortCurrentChecks();

      // Perform Reachability Check
      await this.performReachabilityChecks(clusters);
    } catch (error) {
      LoggerProxy.logger.error(`Reachability:index#gatherReachabilityFallback --> Error:`, error);
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
        'Reachability:index#getReachabilityResults --> Error parsing reachability data: ',
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
          `Reachability:index#isAnyPublicClusterReachable --> Error in parsing reachability data: ${e}`
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
          `Reachability:index#isWebexMediaBackendUnreachable --> Error in parsing reachability data: ${e}`
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
   * Gets the number of reachable clusters from last run reachability check
   * @returns {number} reachable clusters count
   * @private
   * @memberof Reachability
   */
  private getNumberOfReachableClusters(): number {
    let count = 0;

    Object.entries(this.clusterReachability).forEach(([key, clusterReachability]) => {
      const result = clusterReachability.getResult();

      if (
        result.udp.result === 'reachable' ||
        result.tcp.result === 'reachable' ||
        result.xtls.result === 'reachable'
      ) {
        count += 1;
      }
    });

    return count;
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
   * @param {boolean} checkMinRequiredClusters - if true, it will check if we have reached the minimum required clusters and do a fallback if needed
   * @returns {void}
   */
  private resolveReachabilityPromise(checkMinRequiredClusters = true) {
    this.totalDuration = performance.now() - this.startTime;

    this.clearTimer('vmnTimer');
    this.clearTimer('publicCloudTimer');

    this.logUnreachableClusters();
    this.reachabilityDefer?.resolve();

    if (checkMinRequiredClusters) {
      const numReachableClusters = this.getNumberOfReachableClusters();
      if (this.minRequiredClusters && numReachableClusters < this.minRequiredClusters) {
        LoggerProxy.logger.log(
          `Reachability:index#resolveReachabilityPromise --> minRequiredClusters not reached (${numReachableClusters} < ${this.minRequiredClusters}), doing reachability fallback`
        );
        this.gatherReachabilityFallback();
      }
    }
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
      ipver: {
        // @ts-ignore
        firstIpV4: this.webex.internal.device.ipNetworkDetector.firstIpV4,
        // @ts-ignore
        firstIpV6: this.webex.internal.device.ipNetworkDetector.firstIpV6,
        // @ts-ignore
        firstMdns: this.webex.internal.device.ipNetworkDetector.firstMdns,
        // @ts-ignore
        totalTime: this.webex.internal.device.ipNetworkDetector.totalTime,
      },
      trigger: this.lastTrigger,
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

      // check against minimum required clusters, do a new call if we don't have enough

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
   * Clears the timer
   *
   * @param {string} timer name of the timer to clear
   * @returns {void}
   */
  private clearTimer(timer: string) {
    if (this[timer]) {
      clearTimeout(this[timer]);
      this[timer] = undefined;
    }
  }

  /**
   * Aborts current checks that are in progress
   *
   * @returns {void}
   */
  private abortCurrentChecks() {
    this.clearTimer('vmnTimer');
    this.clearTimer('publicCloudTimer');
    this.clearTimer('overallTimer');

    this.abortClusterReachability();
  }

  /**
   * Performs reachability checks for all clusters
   * @param {ClusterList} clusterList
   * @returns {Promise<void>} promise that's resolved as soon as the checks are started
   */
  private async performReachabilityChecks(clusterList: ClusterList) {
    const results: ReachabilityResults = {};

    this.clusterReachability = {};

    this.startTime = performance.now();

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

    if (!clusterList || !Object.keys(clusterList).length) {
      // nothing to do, finish immediately
      this.resolveReachabilityPromise(false);

      this.emit(
        {
          file: 'reachability',
          function: 'performReachabilityChecks',
        },
        'reachability:done',
        {}
      );

      return;
    }

    this.startTimers();

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
          this.clearTimer('overallTimer');
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

  /**
   * Returns the clientMediaPreferences object that needs to be sent to the backend
   * when joining a meeting
   *
   * @param {boolean} isMultistream
   * @param {IP_VERSION} ipver
   * @returns {Object}
   */
  async getClientMediaPreferences(
    isMultistream: boolean,
    ipver?: IP_VERSION
  ): Promise<ClientMediaPreferences> {
    // if 0 or undefined, we assume version 0 and don't send any reachability in clientMediaPreferences
    if (!this.orpheusApiVersion) {
      return {
        ipver,
        joinCookie: await this.getJoinCookie(),
        preferTranscoding: !isMultistream,
      };
    }

    // must be version 1

    // for version 1, the reachability report goes into clientMediaPreferences (and it contains joinCookie)
    const reachabilityReport = (await this.getReachabilityReport()) as {
      joinCookie: any;
      reachability?: ReachabilityReportV1;
    };

    return {
      ipver,
      preferTranscoding: !isMultistream,
      ...reachabilityReport,
    };
  }

  /**
   * Returns the reachability report that needs to be attached to the ROAP messages
   * that we send to the backend.
   * It may return undefined, if reachability is not needed to be attached to ROAP messages (that's the case for v1 or Orpheus API)
   *
   * @returns {Promise<ReachabilityReportV0>} object that needs to be attached to Roap messages
   */
  async getReachabilityReportToAttachToRoap(): Promise<ReachabilityReportV0 | undefined> {
    // version 0
    if (!this.orpheusApiVersion) {
      return this.getReachabilityResults();
    }

    // version 1

    // for version 1 we don't attach anything to Roap messages, reachability report is sent inside clientMediaPreferences
    return undefined;
  }
}

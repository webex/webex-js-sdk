/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable class-methods-use-this */
/* globals window */
import _ from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';
import {ICE_GATHERING_STATE, CONNECTION_STATE, REACHABILITY, IP_VERSION} from '../constants';

import ReachabilityRequest from './request';

const DEFAULT_TIMEOUT = 3000;
const VIDEO_MESH_TIMEOUT = 1000;

export type ICECandidateResult = {clusterId: string; elapsed?: string | null; publicIPs?: string[]};
/**
 * @class Reachability
 * @export
 */
export default class Reachability {
  namespace = REACHABILITY.namespace;
  webex: object;
  reachabilityRequest: any;
  clusterLatencyResults: any;

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

    /**
     * internal object of clusters latency results
     * @instance
     * @type {object}
     * @private
     * @memberof Reachability
     */
    this.clusterLatencyResults = {};
  }

  /**
   * fetches reachability data
   * @returns {Object} reachability data
   * @public
   * @async
   * @memberof Reachability
   */
  public async gatherReachability() {
    this.setup();

    // Remove stored reachability results to ensure no stale data
    // @ts-ignore
    await this.webex.boundedStorage.del(this.namespace, REACHABILITY.localStorageResult);
    // @ts-ignore
    await this.webex.boundedStorage.del(this.namespace, REACHABILITY.localStorageJoinCookie);

    // Fetch clusters and measure latency
    try {
      const {clusters, joinCookie} = await this.reachabilityRequest.getClusters(
        this.getIpVersion()
      );

      // Perform Reachability Check
      const results = await this.performReachabilityCheck(clusters);

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
   * fetches reachability data and checks for cluster reachability
   * @returns {boolean}
   * @public
   * @memberof Reachability
   */
  async isAnyClusterReachable() {
    let reachable = false;
    // @ts-ignore
    const reachabilityData = await this.webex.boundedStorage
      .get(this.namespace, REACHABILITY.localStorageResult)
      .catch(() => {});

    if (reachabilityData) {
      try {
        const reachabilityResults = JSON.parse(reachabilityData);

        reachable = Object.values(reachabilityResults).some(
          (result: any) => result.udp?.reachable === 'true' || result.tcp?.reachable === 'true'
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
   * Returns what we know about the IP version of the networks we're connected to.
   * @returns {IP_VERSION}
   */
  getIpVersion(): IP_VERSION {
    return IP_VERSION.unknown;
  }

  /**
   * Generate peerConnection config settings
   * @param {object} cluster
   * @returns {object} peerConnectionConfig
   * @private
   * @memberof Reachability
   */
  private buildPeerConnectionConfig(cluster: any) {
    const iceServers = _.uniq(cluster.udp).map((url) => ({
      username: '',
      credential: '',
      urls: [url],
    }));

    return {
      iceServers: [...iceServers],
      iceCandidatePoolSize: '0',
      iceTransportPolicy: 'all',
    };
  }

  /**
   * Creates an RTCPeerConnection
   * @param {object} cluster
   * @returns {RTCPeerConnection} peerConnection
   * @private
   * @memberof Reachability
   */
  private createPeerConnection(cluster: any) {
    const {key, config} = cluster;

    try {
      const peerConnection = new window.RTCPeerConnection(config);

      // @ts-ignore
      peerConnection.key = key;

      return peerConnection;
    } catch (peerConnectionError) {
      LoggerProxy.logger.log(
        `Reachability:index#createPeerConnection --> Error creating peerConnection: ${peerConnectionError}`
      );

      return null;
    }
  }

  /**
   * Gets total elapsed time
   * @param {RTCPeerConnection} peerConnection
   * @returns {Number} Milliseconds
   * @private
   * @memberof Reachability
   */
  private getElapsedTime(peerConnection: any) {
    const startTime = peerConnection.begin;

    delete peerConnection.begin;

    return Date.now() - startTime;
  }

  /**
   * creates offer and generates localSDP
   * @param {object} clusterList cluster List
   * @returns {Promise} Reachability latency results
   * @private
   * @memberof Reachability
   */
  private getLocalSDPForClusters(clusterList: object) {
    let clusters: any[] = [...Object.keys(clusterList)];

    clusters = clusters.map(async (key) => {
      const cluster = clusterList[key];
      const config = this.buildPeerConnectionConfig(cluster);
      const peerConnection = this.createPeerConnection({key, config});
      const description = await peerConnection.createOffer({offerToReceiveAudio: true});

      // @ts-ignore
      peerConnection.begin = Date.now();
      peerConnection.setLocalDescription(description);

      return this.iceGatheringState(
        peerConnection,
        cluster.isVideoMesh ? VIDEO_MESH_TIMEOUT : DEFAULT_TIMEOUT
      ).catch((iceGatheringStateError) => {
        LoggerProxy.logger.log(
          `Reachability:index#getLocalSDPForClusters --> Error in getLocalSDP : ${iceGatheringStateError}`
        );
      });
    });

    return Promise.all(clusters)
      .then(this.parseIceResultsToReachabilityResults)
      .then((reachabilityLatencyResults) => {
        this.logUnreachableClusters();

        // return results
        return reachabilityLatencyResults;
      });
  }

  /**
   * Get list of all unreachable clusters
   * @returns {array} Unreachable clusters
   * @private
   * @memberof Reachability
   */
  private getUnreachablClusters() {
    const unreachableList = [];
    const clusters = this.clusterLatencyResults;

    Object.keys(clusters).forEach((key) => {
      const cluster = clusters[key];

      if (cluster.unreachable && !cluster.reachable) {
        unreachableList.push(key);
      }
    });

    return unreachableList;
  }

  /**
   * Attach an event handler for the icegatheringstatechange
   * event and measure latency.
   * @param {RTCPeerConnection} peerConnection
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  private handleIceGatheringStateChange(peerConnection: RTCPeerConnection) {
    peerConnection.onicegatheringstatechange = () => {
      const {COMPLETE} = ICE_GATHERING_STATE;

      if (peerConnection.iceConnectionState === COMPLETE) {
        const elapsed = this.getElapsedTime(peerConnection);

        // @ts-ignore
        LoggerProxy.logger.log(
          // @ts-ignore
          `Reachability:index#onIceGatheringStateChange --> Successfully pinged ${peerConnection.key}:`,
          elapsed
        );
        this.setLatencyAndClose(peerConnection, elapsed);
      }
    };
  }

  /**
   * Attach an event handler for the icecandidate
   * event and measure latency.
   * @param {RTCPeerConnection} peerConnection
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  private handleOnIceCandidate(peerConnection: RTCPeerConnection) {
    peerConnection.onicecandidate = (e) => {
      const SERVER_REFLEXIVE = 'srflx';

      if (e.candidate && String(e.candidate.type).toLowerCase() === SERVER_REFLEXIVE) {
        const elapsed = this.getElapsedTime(peerConnection);

        LoggerProxy.logger.log(
          // @ts-ignore
          `Reachability:index#onIceCandidate --> Successfully pinged ${peerConnection.key}:`,
          elapsed
        );
        // order is important
        this.addPublicIP(peerConnection, e.candidate.address);
        this.setLatencyAndClose(peerConnection, elapsed);
      }
    };
  }

  /**
   * An event handler on an RTCPeerConnection when the state of the ICE
   * candidate gathering process changes. Used to measure connection
   * speed.
   * @private
   * @param {RTCPeerConnection} peerConnection
   * @param {number} timeout
   * @returns {Promise}
   */
  private iceGatheringState(peerConnection: RTCPeerConnection, timeout: number) {
    const ELAPSED = 'elapsed';

    return new Promise<ICECandidateResult>((resolve) => {
      const peerConnectionProxy = new window.Proxy(peerConnection, {
        // eslint-disable-next-line require-jsdoc
        get(target, property) {
          const targetMember = target[property];

          if (typeof targetMember === 'function') {
            return targetMember.bind(target);
          }

          return targetMember;
        },
        set: (target, property, value) => {
          // only intercept elapsed property
          if (property === ELAPSED) {
            // @ts-ignore
            resolve({clusterId: peerConnection.key, publicIPs: target.publicIPs, elapsed: value});

            return true;
          }

          // pass thru
          return window.Reflect.set(target, property, value);
        },
      });

      // Using peerConnection proxy so handle functions below
      // won't be coupled to our promise implementation
      this.handleIceGatheringStateChange(peerConnectionProxy);
      this.handleOnIceCandidate(peerConnectionProxy);

      // Set maximum timeout
      window.setTimeout(() => {
        const {CLOSED} = CONNECTION_STATE;

        // Close any open peerConnections
        if (peerConnectionProxy.connectionState !== CLOSED) {
          // order is important
          this.addPublicIP(peerConnectionProxy, null);
          this.setLatencyAndClose(peerConnectionProxy, null);
        }
      }, timeout);
    });
  }

  /**
   * Make a log of unreachable clusters.
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  private logUnreachableClusters() {
    const list = this.getUnreachablClusters();

    list.forEach((cluster) => {
      LoggerProxy.logger.log(
        `Reachability:index#logUnreachableClusters --> No ice candidate for ${cluster}.`
      );
    });
  }

  /**
   * Calculates time to establish connection
   * @param {Array<ICECandidateResult>} iceResults iceResults
   * @returns {object} reachabilityMap
   * @protected
   * @memberof Reachability
   */
  protected parseIceResultsToReachabilityResults(iceResults: Array<ICECandidateResult>) {
    const reachabilityMap = {};

    iceResults.forEach(({clusterId, elapsed, publicIPs}) => {
      const latencyResult = {};

      if (!elapsed) {
        Object.assign(latencyResult, {reachable: 'false'});
      } else {
        Object.assign(latencyResult, {
          reachable: 'true',
          latencyInMilliseconds: elapsed.toString(),
        });
      }

      if (publicIPs) {
        Object.assign(latencyResult, {
          clientMediaIPs: publicIPs,
        });
      }

      reachabilityMap[clusterId] = {
        udp: latencyResult,
        tcp: {untested: 'true'},
        xtls: {untested: 'true'},
      };
    });

    return reachabilityMap;
  }

  /**
   * fetches reachability data
   * @param {object} clusterList
   * @returns {Promise<localSDPData>} reachability check results
   * @private
   * @memberof Reachability
   */
  private performReachabilityCheck(clusterList: object) {
    if (!clusterList || !Object.keys(clusterList).length) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      this.getLocalSDPForClusters(clusterList)
        .then((localSDPData) => {
          if (!localSDPData || !Object.keys(localSDPData).length) {
            // TODO: handle the error condition properly and try retry
            LoggerProxy.logger.log(
              'Reachability:index#performReachabilityCheck --> Local SDP is empty or has missing elements..returning'
            );
            resolve({});
          } else {
            resolve(localSDPData);
          }
        })
        .catch((error) => {
          LoggerProxy.logger.error(
            `Reachability:index#performReachabilityCheck --> Error in getLocalSDPForClusters: ${error}`
          );
          resolve({});
        });
    });
  }

  /**
   * Adds public IP (client media IPs)
   * @param {RTCPeerConnection} peerConnection
   * @param {string} publicIP
   * @returns {void}
   */
  protected addPublicIP(peerConnection: RTCPeerConnection, publicIP?: string | null) {
    const modifiedPeerConnection: RTCPeerConnection & {publicIPs?: string[]} = peerConnection;
    const {CLOSED} = CONNECTION_STATE;

    if (modifiedPeerConnection.connectionState === CLOSED) {
      LoggerProxy.logger.log(
        `Reachability:index#addPublicIP --> Attempting to set publicIP of ${publicIP} on closed peerConnection.`
      );
    }

    if (publicIP) {
      if (modifiedPeerConnection.publicIPs) {
        modifiedPeerConnection.publicIPs.push(publicIP);
      } else {
        modifiedPeerConnection.publicIPs = [publicIP];
      }
    } else {
      modifiedPeerConnection.publicIPs = null;
    }
  }

  /**
   * Records latency and closes the peerConnection
   * @param {RTCPeerConnection} peerConnection
   * @param {number} elapsed Latency in milliseconds
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  private setLatencyAndClose(peerConnection: RTCPeerConnection, elapsed: number) {
    const REACHABLE = 'reachable';
    const UNREACHABLE = 'unreachable';
    const {CLOSED} = CONNECTION_STATE;
    // @ts-ignore
    const {key} = peerConnection;
    const resultKey = elapsed === null ? UNREACHABLE : REACHABLE;
    const intialState = {[REACHABLE]: 0, [UNREACHABLE]: 0};

    if (peerConnection.connectionState === CLOSED) {
      LoggerProxy.logger.log(
        `Reachability:index#setLatencyAndClose --> Attempting to set latency of ${elapsed} on closed peerConnection.`
      );

      return;
    }

    this.clusterLatencyResults[key] = this.clusterLatencyResults[key] || intialState;
    this.clusterLatencyResults[key][resultKey] += 1;

    // Set to null in case this fired from
    // an event other than onIceCandidate
    peerConnection.onicecandidate = null;
    peerConnection.close();
    // @ts-ignore
    peerConnection.elapsed = elapsed;
  }

  /**
   * utility function
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  private setup() {
    this.clusterLatencyResults = {};
  }
}

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable class-methods-use-this */
/* globals window */
import _ from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';
import {
  ICE_GATHERING_STATE,
  CONNECTION_STATE,
  REACHABILITY
} from '../constants';

import ReachabilityRequest from './request';

/**
 * @class Reachability
 * @export
 */
export default class Reachability {
  /**
   * Creates an instance of Reachability.
   * @param {object} webex
   * @memberof Reachability
   */
  constructor(webex) {
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
  async gatherReachability() {
    this.setup();

    // Remove stored reachability results to ensure no stale data
    if (window?.localStorage?.removeItem) {
      window.localStorage.removeItem(REACHABILITY.localStorage);
    }
    else {
      LoggerProxy.logger.error('Reachability:index#gatherReachability --> Error in accessing LocalStorage.');

      return {};
    }

    // Fetch clusters and measure latency
    try {
      const clusters = await this.reachabilityRequest.getClusters();

      // Perform Reachability Check
      const results = await this.performReachabilityCheck(clusters);

      window.localStorage.setItem(REACHABILITY.localStorage, JSON.stringify(results));

      return results;
    }
    catch (getClusterError) {
      LoggerProxy.logger.error(`Reachability:index#gatherReachability --> Error in calling getClusters(): ${getClusterError}`);

      return {};
    }
  }


  /**
   * Generate peerConnection config settings
   * @param {object} cluster
   * @returns {object} peerConnectionConfig
   * @private
   * @memberof Reachability
   */
  buildPeerConnectionConfig(cluster) {
    const iceServers = _.uniq([
      ...cluster.udp,
      ...cluster.tcp
    ]).map((url) => ({
      username: '',
      credential: '',
      urls: [url]
    }));

    return {
      iceServers: [
        ...iceServers
      ],
      iceCandidatePoolSize: '0',
      iceTransportPolicy: 'all'
    };
  }


  /**
   * Creates an RTCPeerConnection
   * @param {object} cluster
   * @returns {RTCPeerConnection} peerConnection
   * @private
   * @memberof Reachability
   */
  createPeerConnection(cluster) {
    const {key, config} = cluster;

    try {
      const peerConnection = new window.RTCPeerConnection(config);

      peerConnection.key = key;

      return peerConnection;
    }
    catch (peerConnectionError) {
      LoggerProxy.logger.log(`Reachability:index#getLocalSDPForClusters --> Error creating peerConnection: ${peerConnectionError}`);

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
  getElapsedTime(peerConnection) {
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
  getLocalSDPForClusters(clusterList) {
    let clusters = [...Object.keys(clusterList)];

    clusters = clusters.map(async (key) => {
      const cluster = clusterList[key];
      const config = this.buildPeerConnectionConfig(cluster);
      const peerConnection = this.createPeerConnection({key, config});
      const description = await peerConnection.createOffer({offerToReceiveAudio: true});

      peerConnection.begin = Date.now();
      peerConnection.setLocalDescription(description);

      return this.iceGatheringState(peerConnection)
        .catch((iceGatheringStateError) => {
          LoggerProxy.logger.log(`Reachability:index#getLocalSDPForClusters --> Error in getLocalSDP : ${iceGatheringStateError}`);
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
  getUnreachablClusters() {
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
  handleIceGatheringStateChange(peerConnection) {
    peerConnection.onicegatheringstatechange = () => {
      const {COMPLETE} = ICE_GATHERING_STATE;

      if (peerConnection.iceConnectionState === COMPLETE) {
        const elapsed = this.getElapsedTime(peerConnection);

        LoggerProxy.logger.log(`Reachability:index#onIceGatheringStateChange --> Successfully pinged ${peerConnection.key}:`, elapsed);
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
  handleOnIceCandidate(peerConnection) {
    peerConnection.onicecandidate = (e) => {
      const SERVER_REFLEXIVE = 'srflx';

      if (e.candidate && String(e.candidate.type).toLowerCase() === SERVER_REFLEXIVE) {
        const elapsed = this.getElapsedTime(peerConnection);

        LoggerProxy.logger.log(`Reachability:index#onIceCandidate --> Successfully pinged ${peerConnection.key}:`, elapsed);
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
   * @returns {Promise}
   */
  iceGatheringState(peerConnection) {
    const ELAPSED = 'elapsed';
    const waitTime = 5e3;

    return new Promise((resolve) => {
      const peerConnectionProxy = new window.Proxy(peerConnection, {
        get(target, property) {
          const targetMember = target[property];

          if (typeof (targetMember) === 'function') {
            return targetMember.bind(target);
          }

          return targetMember;
        },
        set: (target, property, value) => {
          // only intercept elapsed property
          if (property === ELAPSED) {
            resolve({clusterId: peerConnection.key, elapsed: value});

            return true;
          }

          // pass thru
          return window.Reflect.set(target, property, value);
        }
      });

      // Using peerConnection proxy so handle functions below
      // won't be coupled to our promise implementation
      this.handleIceGatheringStateChange(peerConnectionProxy);
      this.handleOnIceCandidate(peerConnectionProxy);

      // Set maximum timeout
      window.setTimeout(() => {
        const CLOSED = {CONNECTION_STATE};

        // Close any open peerConnections
        if (peerConnectionProxy.connectionState !== CLOSED) {
          this.setLatencyAndClose(peerConnectionProxy, null);
        }
      }, waitTime);
    });
  }


  /**
   * Make a log of unreachable clusters.
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  logUnreachableClusters() {
    const list = this.getUnreachablClusters();

    list.forEach((cluster) => {
      LoggerProxy.logger.log(`Reachability:index#getLocalSDPForClusters --> No ice candidate for ${cluster}.`);
    });
  }


  /**
   * Calculates time to establish connection
   * @param {array} iceResults iceResults
   * @returns {object} reachabilityMap
   * @private
   * @memberof Reachability
   */
  parseIceResultsToReachabilityResults(iceResults) {
    const reachabilityMap = {};

    iceResults.forEach(({clusterId, elapsed}) => {
      let latencyResult;

      if (elapsed === null) {
        latencyResult = {reachable: 'false'};
      }
      else {
        latencyResult = {
          reachable: 'true',
          latencyInMilliseconds: (elapsed).toString()
        };
      }

      reachabilityMap[clusterId] = {
        udp: latencyResult,
        tcp: latencyResult
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
  performReachabilityCheck(clusterList) {
    if (!clusterList || !Object.keys(clusterList).length) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      this.getLocalSDPForClusters(clusterList)
        .then((localSDPData) => {
          if (!localSDPData || !Object.keys(localSDPData).length) {
            // TODO: handle the error condition properly and try retry
            LoggerProxy.logger.log('Reachability:index#performReachabilityCheck --> Local SDP is empty or has missing elements..returning');
            resolve({});
          }
          else {
            resolve(localSDPData);
          }
        })
        .catch((error) => {
          LoggerProxy.logger.error(`Reachability:index#performReachabilityCheck --> Error in getLocalSDPForClusters: ${error}`);
          resolve({});
        });
    });
  }


  /**
   * Records latency and closes the peerConnection
   * @param {RTCPeerConnection} peerConnection
   * @param {number} elapsed Latency in milliseconds
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  setLatencyAndClose(peerConnection, elapsed) {
    const REACHABLE = 'reachable';
    const UNREACHABLE = 'unreachable';
    const {CLOSED} = CONNECTION_STATE;
    const {key} = peerConnection;
    const resultKey = elapsed === null ? UNREACHABLE : REACHABLE;
    const intialState = {[REACHABLE]: 0, [UNREACHABLE]: 0};

    if (peerConnection.connectionState === CLOSED) {
      LoggerProxy.logger.log(`Reachability:index#setLatencyAndClose --> Attempting to set latency of ${elapsed} on closed peerConnection.`);

      return;
    }

    this.clusterLatencyResults[key] = this.clusterLatencyResults[key] || intialState;
    this.clusterLatencyResults[key][resultKey] += 1;

    // Set to null in case this fired from
    // an event other than onIceCandidate
    peerConnection.onicecandidate = null;
    peerConnection.close();
    peerConnection.elapsed = elapsed;
  }


  /**
   * utility function
   * @returns {undefined}
   * @private
   * @memberof Reachability
   */
  setup() {
    this.clusterLatencyResults = {};
  }
}

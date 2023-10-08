/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';

/**
 * @class
 */
const IpNetworkDetector = WebexPlugin.extend({
  idAttribute: 'IpNetworkDetectorId',

  namespace: 'Device',

  props: {
    firstIpV4: ['number', true, -1], // time [ms] it took to receive first IPv4 candidate
    firstIpV6: ['number', true, -1], // time [ms] it took to receive first IPv6 candidate
    firstMdns: ['number', true, -1], // time [ms] it took to receive first mDNS candidate
    totalTime: ['number', true, -1], // total time [ms] it took to do the last IP network detection
  },

  derived: {
    /**
     * True if we know we're on an IPv4 network,
     * False if we know that we are not on an IPv4 network,
     * undefined if we are not sure
     */
    supportsIpV4: {
      deps: ['firstIpV4', 'firstIpV6', 'firstMdns', 'totalTime'],
      /**
       * Function for calculating the value of supportsIpV4 prop
       * @returns {boolean | undefined}
       */
      fn() {
        if (this.firstIpV4 >= 0) {
          return true;
        }
        if (this.totalTime < 0) {
          // we haven't completed the detection, yet
          return undefined;
        }
        if (this.receivedOnlyMDnsCandidates()) {
          return undefined;
        }

        return false;
      },
    },
    /**
     * True if we know we're on an IPv6 network,
     * False if we know that we are not on an IPv6 network,
     * undefined if we are not sure
     */
    supportsIpV6: {
      deps: ['firstIpV4', 'firstIpV6', 'firstMdns', 'totalTime'],
      /**
       * Function for calculating the value of supportsIpV6 prop
       * @returns {boolean | undefined}
       */ fn() {
        if (this.firstIpV6 >= 0) {
          return true;
        }
        if (this.totalTime < 0) {
          // we haven't completed the detection, yet
          return undefined;
        }
        if (this.receivedOnlyMDnsCandidates()) {
          return undefined;
        }

        return false;
      },
    },
  },

  /**
   * Returns true if we have received only mDNS candidates - browsers usually do that if we don't have any user media permissions
   *
   * @private
   * @returns {boolean}
   */
  receivedOnlyMDnsCandidates() {
    return this.totalTime >= 0 && this.firstMdns >= 0 && this.firstIpV4 < 0 && this.firstIpV6 < 0;
  },

  /**
   *
   * @param {RTCPeerConnection} pc Peer connection to use
   * @private
   * @returns {Promise<void>}
   */
  async gatherLocalCandidates(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      let done = false;

      this.firstIpV4 = -1;
      this.firstIpV6 = -1;
      this.firstMdns = -1;
      this.totalTime = -1;
      const startTime = performance.now();

      const doneGatheringIceCandidates = () => {
        if (done) {
          return;
        }
        done = true;

        this.totalTime = performance.now() - startTime;

        resolve();
      };

      pc.onicecandidate = (event) => {
        if (event.candidate?.address) {
          if (event.candidate.address.endsWith('.local')) {
            // if we don't have camera/mic permissions, browser just gives us mDNS candidates
            if (this.firstMdns === -1) {
              this.firstMdns = performance.now() - startTime;
            }
          } else if (event.candidate.address.includes(':')) {
            if (this.firstIpV6 === -1) {
              this.firstIpV6 = performance.now() - startTime;
            }
          } else if (this.firstIpV4 === -1) {
            this.firstIpV4 = performance.now() - startTime;
          }

          if (this.firstIpV4 >= 0 && this.firstIpV6 >= 0) {
            // if we've got both ipv4 and ipv6 candidates, there is no need to wait for any more candidates, we can resolve now
            resolve();
          }
        } else if (event.candidate === null) {
          doneGatheringIceCandidates();
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          doneGatheringIceCandidates();
        }
      };

      pc.createDataChannel('data');

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch((e) => {
          this.webex.logger.error('Failed to detect ip network version:', e);
          reject(e);
        });
    });
  },

  /**
   * Detects if we are on IPv4 and/or IPv6 network. Once it resolves, read the
   * supportsIpV4 and supportsIpV6 props to find out the result.
   *
   * @returns {Promise<Object>}
   */
  async detect() {
    let results;
    let pc;

    try {
      pc = new RTCPeerConnection();

      results = await this.gatherLocalCandidates(pc);
    } finally {
      pc.close();
    }

    return results;
  },
});

export default IpNetworkDetector;

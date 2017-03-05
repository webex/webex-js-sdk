/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {SparkPlugin, SparkHttpError} from '@ciscospark/spark-core';
import {difference, first, last, memoize} from 'lodash';

export const USE_INCOMING = `USE_INCOMING`;
export const USE_CURRENT = `USE_CURRENT`;
export const EQUAL = `EQUAL`;
export const FETCH = `FETCH`;

const Locus = SparkPlugin.extend({
  namespace: `Locus`,

  /**
   * Alert the specified locus that the local user has been notified of the
   * locus's active state
   * @param {Types~Locus} locus
   * @returns {Promise}
   */
  alert(locus) {
    return this.request({
      method: `PUT`,
      uri: `${locus.url}/participant/alert`,
      body: {
        deviceUrl: this.spark.device.url
      }
    })
      .then((res) => res.body);
  },

  /**
   * Calls the specified invitee and offers the specified media via
   * options.localSdp
   * @param {string} invitee
   * @param {Object} options
   * @param {Object} options.localSdp
   * @returns {Promise<Types~Locus>}
   */
  create(invitee, options) {
    options = options || {};

    return this.request({
      method: `POST`,
      service: `locus`,
      resource: `loci/call`,
      body: {
        deviceUrl: this.spark.device.url,
        invitee: {
          invitee
        },
        localMedias: [{
          localSdp: JSON.stringify({
            type: `SDP`,
            sdp: options.localSdp
          })
        }]
      }
    })
      // res.body.mediaConnections is deprecated so just return the locus
      .then((res) => res.body.locus);
  },

  /**
   * Lists active loci
   * @returns {Promise<Array<Types~Locus>>}
   */
  list() {
    return this.request({
      method: `GET`,
      service: `locus`,
      resource: `loci`
    })
      .then((res) => res.body.loci);
  },

  /**
   * Retrieves a single Locus
   * @param {Types~Locus} locus
   * @returns {Types~Locus}
   */
  get(locus) {
    return this.request({
      method: `GET`,
      uri: `${locus.url}`
    })
      .then((res) => res.body);
  },

  /**
   * Join the specified Locus and offer to send it media
   * @param {Types~Locus} locus
   * @param {Object} options
   * @param {Object} options.localSdp
   * @returns {Types~Locus}
   */
  join(locus, options) {
    options = options || {};

    // TODO should options.localSdp be an array?
    return this.request({
      method: `POST`,
      uri: `${locus.url}/participant`,
      body: {
        deviceUrl: this.spark.device.url,
        localMedias: [{
          localSdp: JSON.stringify({
            type: `SDP`,
            sdp: options.localSdp
          })
        }]
      }
    })
      // The mediaConnections object is deprecated, so just return the locus
      .then((res) => res.body.locus);
  },


  /**
   * Leave the specified Locus
   * @param {Types~Locus} locus
   * @returns {Promise<Types~Locus>}
   */
  leave(locus) {
    return this.request({
      method: `PUT`,
      uri: `${locus.self.url}/leave`,
      body: {
        deviceUrl: this.spark.device.url
      }
    })
      .then((res) => res.body.locus)
      .catch((reason) => {
        if (reason instanceof SparkHttpError.Conflict) {
          return this.get(locus);
        }
        return Promise.reject(reason);
      });
  },

  /**
   * Decline to join the specified Locus
   * @param {Types~Locus} locus
   * @returns {Promise<Types~Locus>}
   */
  decline(locus) {
    return this.request({
      method: `PUT`,
      // TODO can this be locus.self.url? or does self only work once we've
      // joined?
      uri: `${locus.url}/participant/decline`,
      body: {
        deviceUrl: this.spark.device.url
      }
    })
      .then((res) => res.body)
      .catch((reason) => {
        if (reason instanceof SparkHttpError.Conflict) {
          return this.get(locus);
        }
        return Promise.reject(reason);
      });
  },

  /**
   * Send a new sdp to Linus via the Locus API to update media state (e.g. to
   * start or stop sending audio or video)
   * @param {Types~Locus} locus
   * @param {Object} options
   * @param {Object} options.localSdp
   * @param {Object} options.mediaId
   * @returns {Promise<Types~Locus>}
   */
  updateMedia(locus, {sdp, audioMuted, videoMuted, mediaId}) {
    return this.request({
      method: `PUT`,
      uri: `${locus.self.url}/media`,
      body: {
        deviceUrl: this.spark.device.url,
        localMedias: [{
          type: `SDP`,
          localSdp: JSON.stringify({
            type: `SDP`,
            sdp,
            audioMuted,
            videoMuted
          }),
          mediaId
        }]
      }
    })
      .then((res) => res.body.locus);
  },

  /**
   * Compares two loci to determine which one contains the most recent state
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {string} one of USE_INCOMING, USE_CURRENT, EQUAL, or FETCH
   */
  compare(current, incoming) {
    if (!current) {
      throw new Error(`\`current\` is required`);
    }

    if (!incoming) {
      throw new Error(`\`incoming\` is required`);
    }
    // complexity here is unavoidable
    /* eslint complexity: [0] */
    /* eslint max-statements: [0] */

    // must pick one of arrow-body-style or no-confusing-arrow to disable
    /* eslint arrow-body-style: [0] */

    // after running the #compare() test suite in a loop, there doesn't seem to
    // be any appreciable difference when used with or without memoize; since
    // real locus sequences are likely to contain more sequence numbers than
    // those in the test suite, I have to assume memoize can only help and the
    // overhead of memoizing these methods is not a problem.

    const getEntriesFirstValue = memoize((locus) => {
      return locus.sequence.entries.length === 0 ? 0 : first(locus.sequence.entries);
    });
    const getEntriesLastValue = memoize((locus) => {
      return locus.sequence.entries.length === 0 ? 0 : last(locus.sequence.entries);
    });
    const getCompareFirstValue = memoize((locus) => {
      return locus.sequence.rangeStart || getEntriesFirstValue(locus);
    });
    const getCompareLastValue = memoize((locus) => {
      return getEntriesLastValue(locus) || locus.sequence.rangeEnd;
    });
    /**
     * @param {number} entry
     * @param {Types~Locus} locus
     * @private
     * @returns {Boolean}
     */
    function inRange(entry, locus) {
      return entry >= locus.sequence.rangeStart && entry <= locus.sequence.rangeEnd;
    }

    if (getCompareLastValue(current) < getCompareFirstValue(incoming)) {
      return USE_INCOMING;
    }

    if (getCompareFirstValue(current) > getCompareLastValue(incoming)) {
      return USE_CURRENT;
    }

    const currentOnlyEntries = difference(current.sequence.entries, incoming.sequence.entries);
    const incomingOnlyEntries = difference(incoming.sequence.entries, current.sequence.entries);
    const currentOnly = [];
    const incomingOnly = [];

    for (const i of currentOnlyEntries) {
      if (!inRange(i, incoming)) {
        currentOnly.push(i);
      }
    }
    for (const i of incomingOnlyEntries) {
      if (!inRange(i, current)) {
        incomingOnly.push(i);
      }
    }

    if (!currentOnly.length && !incomingOnly.length) {
      if (current.sequence.rangeEnd > incoming.sequence.rangeEnd) {
        return USE_CURRENT;
      }
      if (current.sequence.rangeEnd < incoming.sequence.rangeEnd) {
        return USE_INCOMING;
      }
      if (current.sequence.rangeStart < incoming.sequence.rangeStart) {
        return USE_CURRENT;
      }
      if (current.sequence.rangeStart > incoming.sequence.rangeStart) {
        return USE_INCOMING;
      }
      return EQUAL;
    }

    if (currentOnly.length && !incomingOnly.length) {
      return USE_CURRENT;
    }

    if (!currentOnly.length && incomingOnly.length) {
      return USE_INCOMING;
    }

    for (const i of currentOnly) {
      if (getCompareFirstValue(incoming) < i && i < getCompareLastValue(incoming)) {
        return FETCH;
      }
    }

    for (const i of incomingOnly) {
      if (getCompareFirstValue(current) < i && i < getCompareLastValue(current)) {
        return FETCH;
      }
    }

    if (currentOnly[0] > incomingOnly[0]) {
      return USE_CURRENT;
    }

    return USE_INCOMING;
  },

  getCallHistory(options) {
    options = options || {};
    const from = (new Date(options.from || Date.now())).toISOString();

    return this.request({
      method: `GET`,
      service: `janus`,
      resource: `history/userSessions`,
      qs: {from}
    })
      .then((res) => res.body);
  }

});

export default Locus;

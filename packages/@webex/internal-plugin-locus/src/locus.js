/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin, WebexHttpError} from '@webex/webex-core';
import {cloneDeep, difference, first, last, memoize} from 'lodash';
import uuid from 'uuid';

export const USE_INCOMING = 'USE_INCOMING';
export const USE_CURRENT = 'USE_CURRENT';
export const EQUAL = 'EQUAL';
export const FETCH = 'FETCH';
export const GREATER_THAN = 'GREATER_THAN';
export const LESS_THAN = 'LESS_THAN';
export const DESYNC = 'DESYNC';

/**
 * Transates the result of a sequence comparison into an intended behavior
 * @param {string} result
 * @private
 * @returns {string}
 */
function compareToAction(result) {
  switch (result) {
    case EQUAL:
    case GREATER_THAN:
      return USE_CURRENT;
    case LESS_THAN:
      return USE_INCOMING;
    case DESYNC:
      return FETCH;
    default:
      throw new Error(`${result} is not a recognized sequence comparison result`);
  }
}

/**
 * @class
 */
const Locus = WebexPlugin.extend({
  namespace: 'Locus',

  /**
   * Alert the specified locus that the local user has been notified of the
   * locus's active state
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @returns {Promise}
   */
  alert(locus) {
    return this.request({
      method: 'PUT',
      uri: `${locus.url}/participant/alert`,
      body: {
        deviceUrl: this.webex.internal.device.url,
        sequence: locus.sequence,
      },
    }).then((res) => res.body);
  },

  /**
   * Compares two loci to determine which one contains the most recent state
   * @instance
   * @memberof Locus
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @returns {string} one of USE_INCOMING, USE_CURRENT, or FETCH
   */
  compare(current, incoming) {
    /**
     * Determines if a paricular locus's sequence is empty
     * @param {Types~Locus} locus
     * @private
     * @returns {bool}
     */
    function isEmpty(locus) {
      const {sequence} = locus;

      return (
        (!sequence.entries || !sequence.entries.length) &&
        sequence.rangeStart === 0 &&
        sequence.rangeEnd === 0
      );
    }

    if (isEmpty(current) || isEmpty(incoming)) {
      return USE_INCOMING;
    }

    if (incoming.baseSequence) {
      return this.compareDelta(current, incoming);
    }

    return compareToAction(this.compareSequence(current.sequence, incoming.sequence));
  },

  /**
   * Compares two loci sequences (with delta params) and indicates what action
   * to take.
   * @instance
   * @memberof Locus
   * @param {Types~Locus} current
   * @param {Types~Locus} incoming
   * @private
   * @returns {string} one of USE_INCOMING, USE_CURRENT, or FETCH
   */
  compareDelta(current, incoming) {
    let ret = this.compareSequence(current.sequence, incoming.sequence);

    if (ret !== LESS_THAN) {
      return compareToAction(ret);
    }

    ret = this.compareSequence(current.sequence, incoming.baseSequence);

    switch (ret) {
      case GREATER_THAN:
      case EQUAL:
        return USE_INCOMING;
      default:
        return FETCH;
    }
  },

  /**
   * Compares two Locus sequences
   * @instance
   * @memberof Locus
   * @param {LocusSequence} current
   * @param {LocusSequence} incoming
   * @returns {string} one of LESS_THAN, GREATER_THAN, EQUAL, or DESYNC
   */
  compareSequence(current, incoming) {
    if (!current) {
      throw new Error('`current` is required');
    }

    if (!incoming) {
      throw new Error('`incoming` is required');
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

    const getEntriesFirstValue = memoize((sequence) => {
      return sequence.entries.length === 0 ? 0 : first(sequence.entries);
    });
    const getEntriesLastValue = memoize((sequence) => {
      return sequence.entries.length === 0 ? 0 : last(sequence.entries);
    });
    const getCompareFirstValue = memoize((sequence) => {
      return sequence.rangeStart || getEntriesFirstValue(sequence);
    });
    const getCompareLastValue = memoize((sequence) => {
      return getEntriesLastValue(sequence) || sequence.rangeEnd;
    });

    /**
     * @param {number} entry
     * @param {LocusSequence} sequence
     * @private
     * @returns {Boolean}
     */
    function inRange(entry, sequence) {
      return entry >= sequence.rangeStart && entry <= sequence.rangeEnd;
    }

    if (getCompareFirstValue(current) > getCompareLastValue(incoming)) {
      return GREATER_THAN;
    }

    if (getCompareLastValue(current) < getCompareFirstValue(incoming)) {
      return LESS_THAN;
    }

    const currentOnlyEntries = difference(current.entries, incoming.entries);
    const incomingOnlyEntries = difference(incoming.entries, current.entries);
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
      if (
        current.rangeEnd - getCompareFirstValue(current) >
        incoming.rangeEnd - getCompareFirstValue(incoming)
      ) {
        return GREATER_THAN;
      }

      if (
        current.rangeEnd - getCompareFirstValue(current) <
        incoming.rangeEnd - getCompareFirstValue(incoming)
      ) {
        return LESS_THAN;
      }

      return EQUAL;
    }

    if (currentOnly.length && !incomingOnly.length) {
      return GREATER_THAN;
    }

    if (!currentOnly.length && incomingOnly.length) {
      return LESS_THAN;
    }

    if (!current.rangeStart && !current.rangeEnd && !incoming.rangeStart && !incoming.rangeEnd) {
      return DESYNC;
    }

    for (const i of currentOnly) {
      if (getCompareFirstValue(incoming) < i && i < getCompareLastValue(incoming)) {
        return DESYNC;
      }
    }

    for (const i of incomingOnly) {
      if (getCompareFirstValue(current) < i && i < getCompareLastValue(current)) {
        return DESYNC;
      }
    }

    if (currentOnly[0] > incomingOnly[0]) {
      return GREATER_THAN;
    }

    return LESS_THAN;
  },

  /**
   * Calls the specified invitee and offers the specified media via
   * options.localSdp
   * @instance
   * @memberof Locus
   * @param {string} invitee
   * @param {Object} options
   * @param {Object} options.localSdp
   * @returns {Promise<Types~Locus>}
   */
  create(invitee, options = {}) {
    const {correlationId} = options;

    if (!correlationId) {
      throw new Error('options.correlationId is required');
    }

    return (
      this.request({
        method: 'POST',
        service: 'locus',
        resource: 'loci/call',
        body: {
          correlationId,
          deviceUrl: this.webex.internal.device.url,
          invitee: {
            invitee,
          },
          localMedias: [
            {
              localSdp: JSON.stringify({
                type: 'SDP',
                sdp: options.localSdp,
              }),
            },
          ],
          sequence: {
            entries: [],
            rangeStart: 0,
            rangeEnd: 0,
          },
        },
      })
        // res.body.mediaConnections is deprecated so just return the locus
        .then((res) => {
          res.body.locus.self.devices.map((item, index) => {
            item.mediaConnections = [res.body.mediaConnections[index]];

            return item;
          });

          return res.body.locus;
        })
    );
  },

  /**
   * This is mostly an internal function to simplify the phone plugin. Decides
   * which path to call based on the type of the thing being joined.
   * @instance
   * @memberof Locus
   * @param {Object|Types~Locus} target
   * @param {Object} options
   * @private
   * @returns {Promise<Types~Locus>}
   */
  createOrJoin(target, options) {
    if (target.url) {
      return this.join(target, options);
    }

    return this.create(target, options);
  },

  /**
   * Decline to join the specified Locus
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @returns {Promise<Types~Locus>}
   */
  decline(locus) {
    return this.request({
      method: 'PUT',
      uri: `${locus.url}/participant/decline`,
      body: {
        deviceUrl: this.webex.internal.device.url,
        sequence: locus.sequence,
      },
    })
      .then((res) => res.body)
      .catch((reason) => {
        if (reason instanceof WebexHttpError.Conflict) {
          return this.get(locus);
        }

        return Promise.reject(reason);
      });
  },

  /**
   * Retrieves a single Locus
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @returns {Types~Locus}
   */
  get(locus) {
    return this.request({
      method: 'GET',
      uri: `${locus.url}`,
    }).then((res) => res.body);
  },

  /**
   * Retrieves the call history for the current user
   * @instance
   * @memberof Locus
   * @param {Object} options
   * @param {Date|number} options.from
   * @returns {Promise<Object>}
   */
  getCallHistory(options = {}) {
    const from = new Date(options.from || Date.now()).toISOString();

    return this.request({
      method: 'GET',
      service: 'janus',
      resource: 'history/userSessions',
      qs: {from},
    }).then((res) => res.body);
  },

  /**
   * Join the specified Locus and offer to send it media
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @param {Object} options
   * @param {Object} options.localSdp
   * @returns {Types~Locus}
   */
  join(locus, options = {}) {
    const correlationId = locus.correlationId || options.correlationId;

    if (!correlationId) {
      throw new Error('locus.correlationId or options.correlationId is required');
    }

    return (
      this.request({
        method: 'POST',
        uri: `${locus.url}/participant`,
        body: {
          correlationId,
          deviceUrl: this.webex.internal.device.url,
          localMedias: [
            {
              localSdp: JSON.stringify({
                type: 'SDP',
                sdp: options.localSdp,
              }),
            },
          ],
          sequence: locus.sequence || {
            entries: [],
            rangeStart: 0,
            rangeEnd: 0,
          },
        },
      })
        // The mediaConnections object is deprecated, so just return the locus
        .then((res) => {
          res.body.locus.self.devices.map((item, index) => {
            item.mediaConnections = [res.body.mediaConnections[index]];

            return item;
          });

          return res.body.locus;
        })
    );
  },

  /**
   * Leave the specified Locus
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @returns {Promise<Types~Locus>}
   */
  leave(locus) {
    return this.request({
      method: 'PUT',
      uri: `${locus.self.url}/leave`,
      body: {
        deviceUrl: this.webex.internal.device.url,
        sequence: locus.sequence,
      },
    })
      .then((res) => res.body.locus)
      .catch((reason) => {
        if (reason instanceof WebexHttpError.Conflict) {
          return this.get(locus);
        }

        return Promise.reject(reason);
      });
  },

  /**
   * Lists active loci
   * @instance
   * @memberof Locus
   * @returns {Promise<Array<Types~Locus>>}
   */
  list() {
    return this.request({
      method: 'GET',
      service: 'locus',
      resource: 'loci',
    }).then((res) => res.body.loci);
  },

  /**
   * Merges two locus DTOs (for the same locus)
   * @instance
   * @memberof Locus
   * @param {Types~Locus} current
   * @param {Types~Locus|Types~LocusDelta} incoming
   * @returns {Type~Locus}
   */
  merge(current, incoming) {
    // if incoming is not a delta event, treat it as a new full locus.
    if (!incoming.baseSequence) {
      return incoming;
    }

    const next = cloneDeep(current);

    // 1. All non-null elements in the delta event except the "baseSequence" and
    // the "participants" collection should be used to replace their existing
    // values.
    Object.keys(incoming).forEach((key) => {
      if (key === 'baseSequence' || key === 'participants') {
        return;
      }

      next[key] = incoming[key] || next[key];
    });

    // 2. The "baseSequence" in the delta event can be discarded (it doesn't
    // need to be maintained in the local working copy).

    if (incoming.participants || incoming.participants.length) {
      const toRemove = new Set();
      const toUpsert = new Map();

      incoming.participants.forEach((p) => {
        if (p.removed) {
          // Elements of the delta event's "participants" list with the
          // attribute `removed=true` should be removed from the working copy's
          // "participants" collection.
          toRemove.add(p.url);
        } else {
          // Elements of the delta events "participants" list that are absent
          // from the local working copy should be added to that collection.
          toUpsert.set(p.url, p);
        }
      });

      // The "participants" collection in the delta event should be merged with
      // that of the local working copy of the Locus such that elements in the
      // delta event's "participants" replace those with the same url value in
      // the working copy "participants" collection.
      const participants = next.participants.reduce((acc, p) => {
        if (!toRemove.has(p.url)) {
          acc[p.url] = p;
        }

        return acc;
      }, {});

      toUpsert.forEach((value, key) => {
        participants[key] = value;
      });

      next.participants = Object.values(participants);
    }

    return next;
  },

  /**
   * Signals to locus that the current user is done sharing their additional
   * media stream
   * @param {Types~Locus} locus
   * @param {Types~MediaShare} share
   * @returns {Promise}
   */
  releaseFloorGrant(locus, share) {
    return this.webex
      .request({
        uri: share.url,
        method: 'PUT',
        body: {
          floor: {
            disposition: 'RELEASED',
          },
        },
      })
      .then(({body}) => body);
  },

  /**
   * Signals to locus that the current user would like to share an additional
   * media stream
   * @param {Types~Locus} locus
   * @param {Types~MediaShare} share
   * @returns {Promise}
   */
  requestFloorGrant(locus, share) {
    return this.webex
      .request({
        uri: share.url,
        method: 'PUT',
        body: {
          floor: {
            beneficiary: {
              url: locus.self.url,
              devices: [{url: this.webex.internal.device.url}],
            },
            disposition: 'GRANTED',
          },
        },
      })
      .then(({body}) => body);
  },

  /**
   * Sends a string of DTMF tones to the locus
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @param {string} tones
   * @returns {Promise}
   */
  sendDtmf(locus, tones) {
    return this.request({
      method: 'POST',
      uri: `${locus.self.url}/sendDtmf`,
      body: {
        deviceUrl: this.webex.internal.device.url,
        dtmf: {
          correlationId: uuid.v4(),
          tones,
        },
      },
    });
  },

  /**
   * Fetches the delta for the locus from its syncUrl. *Does not merge*
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @returns {Types~LocusDelta}
   */
  sync(locus) {
    return (
      this.request({
        method: 'GET',
        uri: locus.syncUrl,
      })
        // the api may return a 204 no content, so we'll give back an empty
        // object in that case.
        .then((res) => res.body || {})
    );
  },

  /**
   * Send a new sdp to Linus via the Locus API to update media state (e.g. to
   * start or stop sending audio or video)
   * @instance
   * @memberof Locus
   * @param {Types~Locus} locus
   * @param {Object} options
   * @param {string} options.localSdp
   * @param {string} options.mediaId
   * @param {Boolean} options.audioMuted
   * @param {Boolean} options.videoMuted
   * @returns {Promise<Types~Locus>}
   */
  updateMedia(locus, {sdp, audioMuted, videoMuted, mediaId}) {
    const localSdp = {
      audioMuted,
      videoMuted,
    };

    if (sdp) {
      localSdp.type = 'SDP';
      localSdp.sdp = sdp;
    }

    return this.request({
      method: 'PUT',
      uri: `${locus.self.url}/media`,
      body: {
        deviceUrl: this.webex.internal.device.url,
        localMedias: [
          {
            localSdp: JSON.stringify(localSdp),
            mediaId,
          },
        ],
        sequence: locus.sequence,
      },
    }).then((res) => res.body.locus);
  },
});

export default Locus;

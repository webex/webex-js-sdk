/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {filter, get} from 'lodash';

/**
 * Finds the Locus's active participants
 * @param {Types~Locus} locus
 * @private
 * @returns {Array<Types~LocusParticipant>}
 */
export function activeParticipants(locus) {
  return filter(locus.participants, {state: 'JOINED'});
}

/**
 * Indicates if the locus was activated form this device
 * @param {Types~Locus} locus
 * @private
 * @returns {string} unknown|in|out
 */
export function direction(locus) {
  if (!locus || !locus.self) {
    return 'unknown';
  }
  return locus.self.isCreator ? 'out' : 'in';
}

/**
 * Finds the media share share for the call, potentially setting up event
 * listeners to wait for a new Locus
 * @param {Call} call
 * @private
 * @returns {Promise<Types~MediaShare>}
 */
export function waitForMediaShare(call) {
  return function curriedFindShare() {
    const promise = new Promise((resolve, reject) => {
      /**
       * Searches the call's current locus for the screen share entry in media
       * shares
       *
       * @returns {undefined}
       */
      function findShare() {
        try {
          call.logger.info('checking for media share');
          const mediaShare = call.locus.mediaShares.find((share) => share.name === 'content');
          if (!mediaShare) {
            call.logger.info('did not find media share, waiting for next locus change');
            call.once('change:locus', findShare);
            return;
          }

          call.logger.info('found media share');
          resolve(mediaShare);
        }
        catch (err) {
          call.logger.error('something unexpected happened');
          call.logger.error(err);
          reject(err);
        }
      }

      findShare();
    });

    return Promise.race([
      promise,
      new Promise((resolve, reject) => setTimeout(reject(new Error('Could not find media share after 10000ms')), 10000))
    ]);
  };
}

/**
 * Indicates of the specified locus is active
 * @param {Types~Locus} locus
 * @private
 * @returns {Boolean}
 */
export function isActive(locus) {
  return locus.fullState.state === 'ACTIVE';
}

/**
 * Indicates if the specified locus represents a call (in other words, has
 * exactly two participants)
 * @param {Types~Locus} locus
 * @private
 * @returns {Boolean}
 */
export function isCall(locus) {
  return locus && locus.fullState && locus.fullState.type === 'CALL';
}

/**
 * Indicates if the current user has joined the Locus
 * @param {Types~Locus} locus
 * @private
 * @returns {Boolean}
 */
export function joined(locus) {
  return Boolean(locus.self && participantIsJoined(locus.self));
}

/**
 * Indicates if this device has joined the locus
 * @param {ProxySpark} spark
 * @param {Types~Locus} locus
 * @private
 * @returns {Boolean}
 */
export function joinedOnThisDevice(spark, locus) {
  return joined(locus) && spark.internal.device.url === locus.self.deviceUrl;
}

/**
 * Converts a list of participants to a list of memberships
 * @param {SparkCore} spark
 * @param {Types~Locus} locus
 * @private
 * @returns {Array<CallMembership>}
 */
export function participantsToCallMemberships(spark, locus) {
  const users = new Map();
  const devices = new Map();

  for (const participant of locus.participants) {
    if (participant.type === 'USER') {
      users.set(participant.url, participant);
    }
    else if (participant.type === 'RESOURCE_ROOM') {
      devices.set(participant.url, participant);
    }
  }
  const memberships = [];
  users.forEach((participant) => {
    const membership = participantToCallMembership(spark, locus, participant);
    if (participant.devices) {
      for (const device of participant.devices) {
        if (device.state === 'JOINED' && get(device, 'intent.type') === 'OBSERVE') {
          const deviceParticipant = devices.get(device.url);
          membership.audioMuted = remoteAudioMuted(deviceParticipant);
          membership.videoMuted = remoteVideoMuted(deviceParticipant);
        }
      }
    }
    memberships.push(membership);
  });

  return memberships;
}

/**
 * Converts a single participant to a membership
 * @param {SparkCore} spark
 * @param {Types~Locus} locus
 * @param {Object} participant
 * @private
 * @returns {CallMembership}
 */
export function participantToCallMembership(spark, locus, participant) {
  let personId, personUuid;
  if (!participant.person.isExternal) {
    personUuid = participant.person.id;
    personId = spark.people.inferPersonIdFromUuid(participant.person.id);
  }

  return {
    _id: participant.id,
    isSelf: locus.self.url === participant.url,
    isInitiator: participant.isCreator || false,
    personUuid,
    personId,
    state: participantStateToCallMembershipState(participant),
    audioMuted: remoteAudioMuted(participant),
    videoMuted: remoteVideoMuted(participant)
  };
}

/**
 *
 * Maps participant details to membership state enum
 * @param {LocusParticipant} participant
 * @private
 * @returns {string}
 */
export function participantStateToCallMembershipState(participant) {
  const state = participant.state && participant.state.toLowerCase();
  switch (state) {
    case 'idle':
      return 'notified';
    case 'joined':
      return 'connected';
    case 'left':
      return 'disconnected';
    default:
      return state;
  }
}

/**
 * Creates a unique identifier for a call (but not necessarily the "callId" that
 * we'll someday expose as a first-class property)
 *
 * @param {Object} locus
 * @private
 * @returns {string}
 */
export function makeInternalCallId(locus) {
  return `${locus.url}_${locus.fullState.lastActive}`;
}

/**
 * Indicates the direction of the specified media type for the specified
 * participant
 * @param {string} mediaType
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {string} One of `sendonly`, `recvonly`, `sendrecv`, or `inactive`
 */
export function mediaDirection(mediaType, participant) {
  if (!participant) {
    return 'inactive';
  }

  if (!participant.status) {
    return 'inactive';
  }

  return (participant.status[`${mediaType}Status`] || 'inactive').toLowerCase();
}

/**
 * Indicates if the specified participant has joined the Locus
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {Boolean}
 */
export function participantIsJoined(participant) {
  return participant && participant.state === 'JOINED';
}

/**
 * Finds the party in the call that is not the current user
 * @param {Types~Locus} locus
 * @private
 * @returns {Types~LocusParticipant}
 */
export function remoteParticipant(locus) {
  return remoteParticipants(locus)[0];
}

/**
 * Finds all participants of the Locus that are not the current user
 * @param {Types~Locus} locus
 * @private
 * @returns {Types~LocusParticipant}
 */
export function remoteParticipants(locus) {
  return locus.participants.filter((participant) => participant.type === 'USER' && participant.url !== locus.self.url);
}

/**
 * Indicates if the remote party is sending audio
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {Boolean}
 */
export function remoteAudioMuted(participant) {
  return participantIsJoined(participant) && !participant.status.audioStatus.includes('SEND');
}

/**
 * Indicates if the remote party is sending video
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {Boolean}
 */
export function remoteVideoMuted(participant) {
  return participantIsJoined(participant) && !participant.status.videoStatus.includes('SEND');
}

/**
 * Indicates if the `call:incoming` event should be fired for the specified Locus
 * @param {Types~Locus} locus Event which delivered the Locus
 * @param {ProxySpark} spark
 * @private
 * @returns {Boolean}
 */
export function shouldRing(locus) {
  return get(locus, 'self.alertType.action') !== 'NONE';
}

/**
 * Determines the call state from a locus object
 * @param {Types~Locus} locus
 * @private
 * @returns {string}
 */
export function getState(locus) {
  return locus && locus.fullState && locus.fullState.state.toLowerCase();
}

// there's really no good way to split getStatus() up that won't make it less readable
/* eslint-disable complexity */
/**
 * Determines the call state from a locus object. avoids the caching caused by
 * amp state because that leads to out-of-order updates
 * @param {ProxySpark} spark
 * @param {Types~Locus} locus
 * @param {Types~Locus} previousLocus
 * @private
 * @returns {string}
 */
export function getStatus(spark, locus, previousLocus) {
  if (locus) {
    const remote = remoteParticipant(locus);

    if (remote) {
      if (joinedOnThisDevice(spark, locus) && remote && participantIsJoined(remote)) {
        return 'connected';
      }
      if (locus.replaces) {
        for (const replaced of locus.replaces) {
          if (replaced.locusUrl === previousLocus.url && replaced.lastActive === get(previousLocus, 'fullState.lastActive')) {
            return 'replaced';
          }
        }
      }

      const local = locus.self;
      if (remote.state === 'LEFT' || local.state === 'LEFT') {
        return 'disconnected';
      }

      if (remote.state === 'DECLINED') {
        return 'disconnected';
      }

      if (remote.state === 'NOTIFIED') {
        return 'ringing';
      }
    }
  }
  return 'initiated';
}

/**
 * Finds the `self` entry for the specified locus
 * @param {ProxySpark} spark
 * @param {Types~Locus} locus
 * @returns {Object}
 */
export function getThisDevice(spark, locus) {
  return locus && locus.self && locus.self.devices.find((item) => item.url === spark.internal.device.url);
}

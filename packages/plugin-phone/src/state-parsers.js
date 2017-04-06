/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {filter} from 'lodash';

/**
 * Finds the Locus's active participants
 * @param {Types~Locus} locus
 * @private
 * @returns {Array<Types~LocusParticipant>}
 */
export function activeParticipants(locus) {
  return filter(locus.participants, {state: `JOINED`});
}

/**
 * Indicates if the locus was activated form this device
 * @param {Types~Locus} locus
 * @private
 * @returns {string} unknown|in|out
 */
export function direction(locus) {
  if (!locus || !locus.self) {
    return `unknown`;
  }
  return locus.self.isCreator ? `out` : `in`;
}

/**
 * Indicates of the specified locus is active
 * @param {Types~Locus} locus
 * @private
 * @returns {Boolean}
 */
export function isActive(locus) {
  return locus.fullState.state === `ACTIVE`;
}

/**
 * Indicates if the specified locus represents a call (in other words, has
 * exactly two participants)
 * @param {Types~Locus} locus
 * @private
 * @returns {Boolean}
 */
export function isCall(locus) {
  return locus.participants.filter((participant) => participant.type === `USER`).length === 2;
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
  return joined(locus) && spark.device.url === locus.self.deviceUrl;
}

/**
 * Indicates the direction of the specified media type for the specified
 * participant
 * @param {string} mediaType
 * @param {Types~LocusParticipant} participant
 * @returns {string} One of `sendonly`, `recvonly`, `sendrecv`, or `inactive`
 */
export function mediaDirection(mediaType, participant) {
  if (!participant) {
    return `inactive`;
  }

  if (!participant.status) {
    return `inactive`;
  }

  return (participant.status[`${mediaType}Status`] || `inactive`).toLowerCase();
}

/**
 * Indicates if the specified participant has joined the Locus
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {Boolean}
 */
export function participantIsJoined(participant) {
  return participant && participant.state === `JOINED`;
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
  return locus.participants.filter((participant) => participant.type === `USER` && participant.url !== locus.self.url);
}

/**
 * Indicates if the remote party is sending audio
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {Boolean}
 */
export function remoteAudioMuted(participant) {
  return participantIsJoined(participant) && !participant.status.audioStatus.includes(`SEND`);
}

/**
 * Indicates if the remote party is sending video
 * @param {Types~LocusParticipant} participant
 * @private
 * @returns {Boolean}
 */
export function remoteVideoMuted(participant) {
  return participantIsJoined(participant) && !participant.status.videoStatus.includes(`SEND`);
}

/**
 * Indicates if the `call:incoming` event should be fired for the specified Locus
 * @param {Types~MercuryEvent} event Event which delivered the Locus
 * @param {ProxySpark} spark
 * @private
 * @returns {Boolean}
 */
export function shouldRing(event, spark) {
  // TODO [SSDK-575] this is not correct, but it's the best i've got until locus
  // gets back to me
  return event.data.eventType === `locus.participant_joined` && isCall(event.data.locus) && !joinedOnThisDevice(event.data.locus, spark.device.url);
}

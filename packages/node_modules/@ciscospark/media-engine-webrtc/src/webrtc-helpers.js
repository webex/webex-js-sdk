// we need to import the webrtc adapter before anything else happens
/* eslint-disable import/first */

import './webrtc-adapter-adapter';

import {curry, find, filter} from 'lodash';
import {parse} from 'sdp-transform';

/**
 * Pulls the direction line for the specified media kind from an sdp
 * @param {string} kind
 * @param {string} sdp
 * @protected
 * @returns {string}
 */
export function getMediaDirectionFromSDP(kind, sdp) {
  const query = kind === 'screen' ? {
    content: 'slides',
    type: 'video'
  } : {
    type: kind
  };

  const media = find(parse(sdp).media, query);
  if (!media) {
    return 'inactive';
  }

  return media.direction;
}

/**
 *
 * @param {string} kind
 * @param {string} sdp
 * @param {string} direction
 * @protected
 * @returns {object}
 */
export function getMediaFromSDP(kind, sdp, direction) {
  const query = kind === 'screen' ? {
    content: 'slides',
    type: 'video'
  } : {
    type: kind
  };

  let media = filter(parse(sdp).media, query);

  const mediaTypes = {};

  if (direction) {
    if (direction === 'sendrecv') {
      media.forEach((m) => {
        mediaTypes[m.direction] = m;
      });
      // This adds support for when Firefox splits a sendrecv media connection into
      // separate sendonly and recvonly connections. This is ok as long as both
      // connections exist and are in the correct direction. Possibly a FF bug that
      // will be resolved in the future.
      if (mediaTypes.sendrecv && !mediaTypes.recvonly && !mediaTypes.sendonly) {
        media = mediaTypes.sendrecv;
      }
      else if (!mediaTypes.sendrecv && mediaTypes.recvonly && mediaTypes.sendonly) {
        media = [mediaTypes.recvonly, mediaTypes.sendonly];
      }
    }
    else {
      media = media.filter((m) => m.direction === direction);
    }
  }

  return media;
}

/**
 * Reverses a media direction from offer to answer (e.g. sendonly -> recvonly)
 * @param {string} direction
 * @protected
 * @returns {string}
 */
export function reverseMediaDirection(direction) {
  switch (direction) {
    case 'inactive':
    case 'sendrecv':
      return direction;
    case 'sendonly':
      return 'recvonly';
    case 'recvonly':
      return 'sendonly';
    default:
      throw new Error(`direction "${direction}" is not valid`);
  }
}

/**
 * Checks a given sdp to ensure it contains an offer for the h264 codec
 * @param {boolean} wantsVideo
 * @param {string} offer
 * @protected
 * @returns {string} returns the offer to simplify use in promise chains
 */
export const ensureH264 = curry((wantsVideo, offer) => {
  if (wantsVideo) {
    if (!offer.includes('m=video')) {
      throw new Error('No video section found in offer');
    }
    if (!/[hH]264/.test(offer)) {
      throw new Error('Offer does not include h264 codec');
    }
  }
  return offer;
});

/**
 * Adds a bandwith limit line to the sdp; without this line, calling fails
 * @param {Object} bandwidthLimit
 * @param {string} sdp SDP
 * @protected
 * @returns {string} The modified SDP
 */
export function limitBandwith({audioBandwidthLimit, videoBandwidthLimit}, sdp) {
  return sdp.split('\r\n').reduce((lines, line) => {
    lines.push(line);
    if (line.startsWith('m=')) {
      lines.push(`b=TIAS:${line.includes('audio') ? audioBandwidthLimit : videoBandwidthLimit}`);
    }
    return lines;
  }, []).join('\r\n');
}

/**
 * Helper for dealing wait capitalization
 * @param {string} kind audio|video
 * @protected
 * @returns {string} Audio|Video
 */
export function kindToPropertyFragment(kind) {
  return kind === 'audio' ? 'Audio' : 'Video';
}

/**
 * Like get getMediaDirectionFromSDP, but reverses the the result
 * @param {string} kind
 * @param {string} offerSdp
 * @protected
 * @returns {string}
 */
export function getMediaDirectionFromSDPForAnswer(kind, offerSdp) {
  return reverseMediaDirection(getMediaDirectionFromSDP(kind, offerSdp));
}


/**
 * Converts a pair of booleans to a SDP direction string
 * @param {boolean} send
 * @param {boolean} recv
 * @protected
 * @returns {string}
 */
export function boolToDirection(send, recv) {
  if (send && recv) {
    return 'sendrecv';
  }

  if (send) {
    return 'sendonly';
  }

  if (recv) {
    return 'recvonly';
  }

  return 'inactive';
}

/**
 * Determines the flow of media for a given kind of media on a peer connection
 * @param {string} kind
 * @param {RTCPeerConnection} pc
 * @protected
 * @returns {string}
 */
export function getMediaDirectionFromTracks(kind, pc) {
  if (pc.signalingState === 'closed') {
    return 'inactive';
  }

  const senders = pc
    .getSenders()
    .filter((s) => s.track && s.track.kind === kind);

  const send = senders.length > 0 && senders.reduce((acc, s) => acc || s.track.enabled, false);

  const receivers = pc
    .getReceivers()
    .filter((r) => r.track && r.track.kind === kind);

  const recv = receivers.length > 0 && receivers.reduce((acc, r) => acc || r.track.enabled, false);
  return boolToDirection(send, recv);
}

/**
 * Our services don't support extmap lines in sdps, so we need to remove them
 * @param {string} sdp
 * @returns {string}
 */
export function removeExtmap(sdp) {
  return sdp.replace(/a=extmap.*\r\n/g, '');
}

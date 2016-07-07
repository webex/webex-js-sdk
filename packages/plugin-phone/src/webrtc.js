/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint max-nested-callbacks: [0] */

import 'webrtc-adapter';
import {curry, defaults, find} from 'lodash';
import {tap} from '@ciscospark/common';
import {
  addToMappedWeakMappedSet,
  getMappedWeakMappedSet
} from './map-utils';

const tracksByKindByStream = new Map();
const storeMediaTrackByKindByStream = addToMappedWeakMappedSet(tracksByKindByStream);
const getMediaTracksByKindByStream = getMappedWeakMappedSet(tracksByKindByStream);
const getVideoTracksByStream = getMediaTracksByKindByStream(`video`);
const getAudioTracksByStream = getMediaTracksByKindByStream(`audio`);

const startSendingMedia = curry((kind, pc) => {
  let foundKind = false;
  pc.getLocalStreams().forEach((stream) => {
    // Find all the tracks we've removed from the stream/pc so we can readd them
    const tracks = getMediaTracksByKindByStream(kind, stream);
    tracks.forEach((track) => {
      foundKind = foundKind || true;
      track.enabled = true;
      // Because adapter.js doesn't actually hide all the cross browser
      // inconsistencies
      if (pc.addTrack) {
        pc.addTrack(track, stream);
      }
      else {
        stream.addTrack(track);
      }
    });
    tracks.delete(stream);
  });

  // If we didn't find any tracks for this stream/pc, we need to get new media
  if (!foundKind) {
    const constraints = {
      audio: kind === `audio`,
      video: kind === `video`
    };

    return getUserMedia(constraints)
      .then((stream) => addStream(pc, stream));
  }

  return Promise.resolve();
});

const stopSendingMedia = curry((kind, pc) => {
  pc.getLocalStreams().forEach((stream) => {
    stream.getTracks().forEach((track) => {
      if (track.kind === kind) {
        track.enabled = false;
        // Store the tracks so we can add them back later (should the user want
        // to mute/unmute)
        storeMediaTrackByKindByStream(kind, stream, track);
        if (pc.removeTrack) {
          const sender = find(pc.getSenders(), (s) => s.track === track);
          pc.removeTrack(sender);
        }
        else {
          stream.removeTrack(track);
        }
      }
    });
  });
});

/**
 * Adds a bandwith limit line to the sdp; without this line, calling fails
 * @param {string} sdp SDP
 * @private
 * @returns {string} The modified SDP
 */
function limitBandwith(sdp) {
  // TODO can limitBandwith be done with the sender/reciever apis?
  return sdp.split(`\r\n`).reduce((lines, line) => {
    lines.push(line);
    if (line.startsWith(`m=`)) {
      lines.push(`b=TIAS:${line.includes(`audio`) ? 64000 : 1000000}`);
    }
    return lines;
  }, []).join(`\r\n`);
}

/**
 * Ends all streams for the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to end all
 * streams
 * @private
 * @returns {undefined}
 */
function endAllStreams(pc) {
  reattachTracks(pc);
  pc.getLocalStreams().forEach(stopStream);
  pc.getRemoteStreams().forEach(stopStream);
}

/**
 * Stops the specifed stream's tracks and the stream (depending on browser
 * capabilities)
 * @param {MediaStream} stream The MediaStream to stop
 * @private
 * @returns {undefined}
 */
function stopStream(stream) {
  // need to reattach any removed tracks (even if they're stopped) to make sure
  // the camera gets turned off.
  if (stream.getTracks) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (stream.stop) {
    stream.stop();
  }
}

/**
 * Attaches all tracks that were removed from the specifed RTCPeerConnection
 * (e.g. while muting said tracks). Without reattaching them, the camera may
 * never turn off
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to reattach tracks
 * @private
 * @returns {undefined}
 */
function reattachTracks(pc) {
  pc.getLocalStreams().forEach(reattachTracksForStream);
}

/**
 * Reattaches tracks for specifed stream
 * @param {MediaStream} stream The MediaStream to which to reattach tracks
 * @private
 * @returns {undefined}
 */
function reattachTracksForStream(stream) {
  const vt = getVideoTracksByStream(stream);
  vt.forEach((track) => stream.addTrack(track));
  vt.clear();

  const at = getAudioTracksByStream(stream);
  at.forEach((track) => stream.addTrack(track));
  at.clear();
}

/**
 * Stops sending audio via the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to stop audio
 * @private
 * @returns {Promise}
 */
export const startSendingAudio = startSendingMedia(`audio`);
/**
 * Stops sending video via the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to stop video
 * @private
 * @returns {Promise}
 */
export const startSendingVideo = startSendingMedia(`video`);
/**
 * Starts sending audio via the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to start audio
 * @private
 * @returns {Promise}
 */
export const stopSendingAudio = stopSendingMedia(`audio`);
/**
 * Stops sending video via the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to start video
 * @private
 * @returns {Promise}
 */
export const stopSendingVideo = stopSendingMedia(`video`);

/**
 * Wrapper around navigator.mediaDevices.getUserMedia()
 * @param {MediaStreamConstraints} constraints if NODE_ENV is `test`, will
 * automatically add `{fake: true}`. If this is problematic for your use case,
 * you'll need to explicitly include `{fake: false}`
 * @private
 * @returns {Promise<MediaStream>} The resultant MediaStream
 */
export function getUserMedia(constraints) {
  defaults(constraints, {fake: process.env.NODE_ENV === `test`});
  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Creates an offer sdp based on the state of the specifed RTCPeerConnection and
 * offer options
 * @param {RTCPeerConnection} pc
 * @param { RTCOfferOptions} offerOptions
 * @private
 * @returns {Promise<string>} Resolves with the offer sdp
 */
export const createOffer = curry((pc, offerOptions) => {
  offerOptions = offerOptions || {};
  defaults(offerOptions, {
    offerToReceiveVideo: true,
    offerToReceiveAudio: true
  });

  const promise = new Promise((resolve) => {
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.onicecandidate = undefined;
        resolve();
      }
    };
  });

  return pc.createOffer(offerOptions)
    .then(tap((offer) => {offer.sdp = limitBandwith(offer.sdp);}))
    .then((offer) => pc.setLocalDescription(offer))
    .then(() => Promise.resolve(promise))
    .then(() => limitBandwith(pc.localDescription.sdp));
});

/**
 * Applies an incoming answer sdp to the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc
 * @param {string} sdp
 * @private
 * @returns {Promise}
 */
export const acceptAnswer = curry((pc, sdp) => pc.setRemoteDescription(new RTCSessionDescription({
  sdp,
  type: `answer`
})));

/**
 * Terminates the specifed RTCPeerConnection
 * @param {RTCPeerConnection} pc
 * @private
 * @returns {undefined}
 */
export const end = curry((pc) => {
  if (pc.signalingState !== `closed`) {
    endAllStreams(pc);
    pc.close();
  }
});

const curriedAddStream = curry(addStream);

/**
 * Adds the specifed stream to the specifed RTCPeerConnection
 * @name addStream
 * @param {PeerConnection} pc The RTCPeerConnection to which to add the stream
 * @param {MediaStream} stream The stream to add
 * @private
 * @returns {undefined}
 */
export {curriedAddStream as addStream};

/**
 * Adds the specifed stream to the specifed RTCPeerConnection
 * @param {PeerConnection} pc The RTCPeerConnection to which to add the stream
 * @param {MediaStream} stream The stream to add
 * @private
 * @returns {undefined}
 */
function addStream(pc, stream) {
  // TODO do either of these return promises?
  if (pc.addTrack) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }
  else {
    pc.addStream(stream);
  }
}

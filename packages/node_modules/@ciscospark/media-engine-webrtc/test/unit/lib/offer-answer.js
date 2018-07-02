import {assert} from '@ciscospark/test-helper-chai';
import {find, filter} from 'lodash';
import {parse} from 'sdp-transform';
import {Promise} from 'es6-promise';

let pc, stream;

export function setupRemotePeerConnection() {
  console.log('resetting remote PC and stream');
  pc = new RTCPeerConnection({
    iceServers: [],
    bundlePolicy: 'max-compat'
  });

  stream = null;
}
/**
 * Simulates a server's sdp response
 * @param {string} offerSdp created from engine.createOffer
 * @returns {object} answer
 */
export function simulateAnswer(offerSdp) {
  const sdp = parse(offerSdp);

  const audioMedia = filter(sdp.media, {type: 'audio'});
  const videoMedia = filter(sdp.media, {type: 'video'});

  const wantsAudio = audioMedia && !!find(audioMedia, (m) => m.direction.includes('recv'));
  const wantsVideo = videoMedia && !!find(videoMedia, (m) => m.direction.includes('recv'));

  const hasAudio = !!pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
  const hasVideo = !!pc.getSenders().find((s) => s.track && s.track.kind === 'video');

  console.log(`wantsAudio: ${wantsAudio}`);
  console.log(`wantsVideo: ${wantsVideo}`);
  console.log(`hasAudio: ${hasAudio}`);
  console.log(`hasVideo: ${hasVideo}`);

  return pc.setRemoteDescription(new RTCSessionDescription({type: 'offer', sdp: offerSdp}))
    .then(() => {
      if (wantsAudio && !hasAudio || wantsVideo && !hasVideo) {
        return navigator.mediaDevices.getUserMedia({
          audio: wantsAudio && !hasAudio,
          video: wantsVideo && !hasVideo,
          fake: true
        }).then((newStream) => {
          if (!stream) {
            stream = newStream;
          }

          newStream.getTracks().forEach((track) => {
            const t = pc.getSenders().find((s) => s.track && s.track.kind === track.kind);
            if (t) {
              t.enabled = true;
            }
            else {
              if (!stream.getTracks().includes(track)) {
                console.info(`adding ${track.kind} track to mock stream`);
                stream.addTrack(track);
              }

              console.info(`adding ${track.kind} track to mock peer`);
              pc.addTrack(track, stream);
            }
          });
        });
      }
      return Promise.resolve();
    })
    .then(() => {
      if (hasAudio && !wantsAudio) {
        console.info('removing audio track from mock peer');
        pc.getSenders().forEach((s) => {
          const {track} = s;
          if (track && track.kind === 'audio') {
            stream.removeTrack(track);
            pc.removeTrack(s);
          }
        });
      }

      if (hasVideo && !wantsVideo) {
        console.info('removing video track from mock peer');
        pc.getSenders().forEach((s) => {
          const {track} = s;
          if (s.track && s.track.kind === 'video') {
            stream.removeTrack(track);
            pc.removeTrack(s);
          }
        });
      }

      return Promise.resolve();
    })
    .then(() => {
      const senders = pc.getSenders();
      if (senders.length) {
        const audioSenders = senders.filter((s) => s.track && s.track.kind === 'audio');
        const videoSenders = senders.filter((s) => s.track && s.track.kind === 'video');
        assert.isBelow(audioSenders.length, 2, 'there is never more than one local audio sender track');
        assert.isBelow(videoSenders.length, 2, 'there is never more than one local video sender track');

        console.info('MOCK TRACKS');
        console.info('audio', audioSenders.map((s) => `${s.track.id} - ${s.track.enabled}`));
        console.info('video', videoSenders.map((s) => `${s.track.id} - ${s.track.enabled}`));
        console.info('END MOCK TRACKS');
      }
      return pc.createAnswer();
    })
    .then((answer) => pc.setLocalDescription(answer)
      .then(() => answer))
    .then((answer) => {
      let answerSdp = answer.sdp;
      const slides = find(sdp.media, {
        content: 'slides',
        type: 'video'
      });
      if (slides) {
        const [a, b] = answerSdp.split(`a=mid:${slides.mid}`);
        answerSdp = [a, `a=mid:${slides.mid}`, '\r\na=content:slides', b].join('');
      }
      return answerSdp;
    });
}

export function clearRemoteSession() {
  if (pc) {
    if (pc.signalingState !== 'closed') {
      pc.getSenders().forEach((s) => s.track && s.track.stop());
      pc.close();
    }
    pc.onnegotiationneeded = undefined;
    pc.ontrack = undefined;
    pc.onicecandidate = undefined;
  }
  pc = undefined;
  stream = null;
}

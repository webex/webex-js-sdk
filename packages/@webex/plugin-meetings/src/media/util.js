/* globals MediaStream */
import window from 'global/window';

import BrowserDetection from '../common/browser-detection';
import LoggerProxy from '../common/logs/logger-proxy';

const {isBrowser} = BrowserDetection();

const MediaUtil = {};

MediaUtil.createPeerConnection = (turnServerInfo) => {
  const config = {iceServers: []};

  if (turnServerInfo) {
    config.iceServers.push({
      urls: turnServerInfo.url,
      username: turnServerInfo.username || '',
      credential: turnServerInfo.password || ''
    });
  }
  if (isBrowser('firefox')) {
    config.bundlePolicy = 'max-compat';
  }

  return new window.RTCPeerConnection(config);
};


MediaUtil.createMediaStream = (tracks) => {
  if (!tracks) {
    LoggerProxy.logger.error('Media:util#createMediaStream --> Tracks don\'t exist');
  }
  const filtredTracks = tracks.filter((element) => !!element);

  return new MediaStream(filtredTracks);
};

export default MediaUtil;

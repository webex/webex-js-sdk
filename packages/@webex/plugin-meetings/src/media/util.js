/* globals MediaStream */
import window from 'global/window';

import BrowserDetection from '../common/browser-detection';
import {
  RTC_CONFIGURATION,
  RTC_CONFIGURATION_FIREFOX
} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

const {isBrowser} = BrowserDetection();

const MediaUtil = {};

MediaUtil.createPeerConnection = () => new window.RTCPeerConnection(
  isBrowser('firefox') ? RTC_CONFIGURATION_FIREFOX : RTC_CONFIGURATION
);

MediaUtil.createMediaStream = (tracks) => {
  if (!tracks) {
    LoggerProxy.logger.error('Media:util#createMediaStream --> Tracks don\'t exist');
  }
  const filtredTracks = tracks.filter((element) => !!element);

  return new MediaStream(filtredTracks);
};

export default MediaUtil;

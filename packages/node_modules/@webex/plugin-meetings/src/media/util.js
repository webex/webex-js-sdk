/* globals MediaStream */

import LoggerProxy from '../common/logs/logger-proxy';

const MediaUtil = {};

MediaUtil.createMediaStream = (tracks) => {
  if (!tracks) {
    LoggerProxy.logger.error('Media:util#createMediaStream --> Tracks don\'t exist');
  }
  const filtredTracks = tracks.filter((element) => !!element);

  return new MediaStream(filtredTracks);
};

export default MediaUtil;

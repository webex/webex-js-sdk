/* globals MediaStream */

import LoggerProxy from '../common/logs/logger-proxy';

const MediaUtil: any = {};

MediaUtil.createMediaStream = (tracks: MediaStreamTrack[]) => {
  if (!tracks) {
    LoggerProxy.logger.error("Media:util#createMediaStream --> Tracks don't exist");
  }
  const filtredTracks = tracks.filter((element) => !!element);

  return new MediaStream(filtredTracks);
};

export default MediaUtil;

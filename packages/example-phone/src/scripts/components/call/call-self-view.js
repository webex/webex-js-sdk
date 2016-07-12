import React from 'react';
import Video from '../common/video';
import MediaStatus from './media-status';

export default function SelfView({
  localAudioDirection,
  localMediaStreamUrl,
  localVideoDirection,
  ...rest
}) {
  return (
    <div className="self-view">
      <Video muted src={localMediaStreamUrl} {...rest} />
      <MediaStatus audioDirection={localAudioDirection} videoDirection={localVideoDirection} />
    </div>
  );
}

SelfView.propTypes = {
  localAudioDirection: React.PropTypes.string.isRequired,
  localMediaStreamUrl: React.PropTypes.string.isRequired,
  localVideoDirection: React.PropTypes.string.isRequired
};

import React from 'react';
import Video from '../common/video';

export default function RemoteView({
  receivingVideo,
  remoteMediaStreamUrl,
  ...rest
}) {
  let mediaElement;
  if (receivingVideo) {
    mediaElement = <Video src={remoteMediaStreamUrl} {...rest} />;
  }
  else {
    // eslint-disable-next-line no-extra-parens
    mediaElement = (
      <div>
        <audio src={remoteMediaStreamUrl} />
        <img src="images/default_avatar_individual.png" />
      </div>
    );
  }

  return (
    <div className="remote-view">
      {mediaElement}
    </div>
  );
}

RemoteView.propTypes = {
  receivingVideo: React.PropTypes.bool.isRequired,
  remoteMediaStreamUrl: React.PropTypes.string.isRequired
};

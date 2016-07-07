import React from 'react';
import Video from '../common/video';

export default function SelfView({localMediaStreamUrl, ...rest}) {
  return (
    <div className="self-view">
      <Video src={localMediaStreamUrl} {...rest} />
    </div>
  );
}

SelfView.propTypes = {
  localMediaStreamUrl: React.PropTypes.string.isRequired
};

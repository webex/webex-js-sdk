import React from 'react';

export default function MediaStatus({audioDirection, videoDirection}) {
  return (
    <table>
      <tbody>
        <tr>
          <td>audio:</td>
          <td className="audio-direction">{audioDirection}</td>
        </tr>
        <tr>
          <td>video:</td>
          <td className="video-direction">{videoDirection}</td>
        </tr>
      </tbody>
    </table>
  );
}

MediaStatus.propTypes = {
  audioDirection: React.PropTypes.string.isRequired,
  videoDirection: React.PropTypes.string.isRequired
};

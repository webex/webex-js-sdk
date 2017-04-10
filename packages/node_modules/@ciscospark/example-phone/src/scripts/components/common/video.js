import React from 'react';

export default function Video(props) {
  return (
    <div className="video-container">
      <video autoPlay {...props} />
    </div>
  );
}

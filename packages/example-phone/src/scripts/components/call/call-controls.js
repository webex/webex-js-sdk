import React from 'react';
import {Button, ButtonGroup} from 'react-bootstrap';

import ToggleButton from '../common/toggle-button';

export default function CallControls({
  onHangup,
  onStartReceivingAudio,
  onStartReceivingVideo,
  onStartSendingAudio,
  onStartSendingVideo,
  onStopReceivingAudio,
  onStopReceivingVideo,
  onStopSendingAudio,
  onStopSendingVideo,
  receivingAudio,
  receivingVideo,
  sendingAudio,
  sendingVideo
}) {
  return (
    <div className="call-controls">
      <ButtonGroup>
        <ToggleButton
          active={sendingAudio}
          activeStyle=""
          activeTitle="Stop sending audio"
          inactiveStyle="warning"
          inactiveTitle="Start sending audio"
          onActivate={onStartSendingAudio}
          onDeactivate={onStopSendingAudio}
        >Send Audio</ToggleButton>
        <ToggleButton
          active={sendingVideo}
          activeStyle=""
          activeTitle="Stop sending video"
          inactiveStyle="warning"
          inactiveTitle="Start sending video"
          onActivate={onStartSendingVideo}
          onDeactivate={onStopSendingVideo}
        >Send Video</ToggleButton>
        <ToggleButton
          active={receivingAudio}
          activeStyle=""
          activeTitle="Stop receiving audio"
          inactiveStyle="warning"
          inactiveTitle="Start receiving audio"
          onActivate={onStartReceivingAudio}
          onDeactivate={onStopReceivingAudio}
        >Receive Audio</ToggleButton>
        <ToggleButton
          active={receivingVideo}
          activeStyle=""
          activeTitle="Stop receiving video"
          inactiveStyle="warning"
          inactiveTitle="Start receiving video"
          onActivate={onStartReceivingVideo}
          onDeactivate={onStopReceivingVideo}
        >Receive Video</ToggleButton>
      </ButtonGroup>
      <Button bsStyle="danger" onClick={onHangup} title="Hang up">Hang Up</Button>
    </div>
  );
}

CallControls.propTypes = {
  onHangup: React.PropTypes.func.isRequired,
  onStartReceivingAudio: React.PropTypes.func.isRequired,
  onStartReceivingVideo: React.PropTypes.func.isRequired,
  onStartSendingAudio: React.PropTypes.func.isRequired,
  onStartSendingVideo: React.PropTypes.func.isRequired,
  onStopReceivingAudio: React.PropTypes.func.isRequired,
  onStopReceivingVideo: React.PropTypes.func.isRequired,
  onStopSendingAudio: React.PropTypes.func.isRequired,
  onStopSendingVideo: React.PropTypes.func.isRequired,
  receivingAudio: React.PropTypes.bool.isRequired,
  receivingVideo: React.PropTypes.bool.isRequired,
  sendingAudio: React.PropTypes.bool.isRequired,
  sendingVideo: React.PropTypes.bool.isRequired
};

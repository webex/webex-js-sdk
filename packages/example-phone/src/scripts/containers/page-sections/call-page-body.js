import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {injectSpark} from '../../modules/redux-spark';
import Call from '../../components/call';

import {
  hangup,
  startReceivingAudio,
  startReceivingVideo,
  startSendingAudio,
  startSendingVideo,
  stopReceivingAudio,
  stopReceivingVideo,
  stopSendingAudio,
  stopSendingVideo
} from '../../actions/call';

class CallPageBody extends Component {
  static propTypes = {
    startReceivingAudio: React.PropTypes.func.isRequired,
    startReceivingVideo: React.PropTypes.func.isRequired,
    startSendingAudio: React.PropTypes.func.isRequired,
    startSendingVideo: React.PropTypes.func.isRequired,
    status: React.PropTypes.string.isRequired,
    stopReceivingAudio: React.PropTypes.func.isRequired,
    stopReceivingVideo: React.PropTypes.func.isRequired,
    stopSendingAudio: React.PropTypes.func.isRequired,
    stopSendingVideo: React.PropTypes.func.isRequired
  };

  render() {
    const {status} = this.props;
    if (status === `connected`) {
      return (
        <Call
          onHangup={this.handleHangup.bind(this)}
          onStartReceivingAudio={this.handleStartReceivingAudio.bind(this)}
          onStartReceivingVideo={this.handleStartReceivingVideo.bind(this)}
          onStartSendingAudio={this.handleStartSendingAudio.bind(this)}
          onStartSendingVideo={this.handleStartSendingVideo.bind(this)}
          onStopReceivingAudio={this.handleStopReceivingAudio.bind(this)}
          onStopReceivingVideo={this.handleStopReceivingVideo.bind(this)}
          onStopSendingAudio={this.handleStopSendingAudio.bind(this)}
          onStopSendingVideo={this.handleStopSendingVideo.bind(this)}
          {...this.props}
        />
      );
    }

    return null;
  }
}

// Bind actions to CallPageBody methods (I feel like there's got to be a cleaner
// way to do this. thunk actions have a getState() param but i'm not sure it
// makes sense to tie actions to the shape of the state tree)
[
  [`hangup`, `handleHangup`],
  [`startReceivingAudio`, `handleStartReceivingAudio`],
  [`startReceivingVideo`, `handleStartReceivingVideo`],
  [`startSendingAudio`, `handleStartSendingAudio`],
  [`startSendingVideo`, `handleStartSendingVideo`],
  [`stopReceivingAudio`, `handleStopReceivingAudio`],
  [`stopReceivingVideo`, `handleStopReceivingVideo`],
  [`stopSendingAudio`, `handleStopSendingAudio`],
  [`stopSendingVideo`, `handleStopSendingVideo`]
].forEach(([propName, handlerName]) => {
  CallPageBody.prototype[handlerName] = function handleMediaAction() {
    const {call} = this.props;
    const fn = this.props[propName];
    fn(call);
  };
});

export default connect(
  (state) => state.activeCall,
  (dispatch) => bindActionCreators({
    hangup,
    startReceivingAudio,
    startReceivingVideo,
    startSendingAudio,
    startSendingVideo,
    stopReceivingAudio,
    stopReceivingVideo,
    stopSendingAudio,
    stopSendingVideo
  }, dispatch)
)(injectSpark(CallPageBody));


import PeerConnectionManager from '../peer-connection-manager';
import {
  _ANSWER_,
  _ERROR_,
  _CONFLICT_,
  ROAP,
  SDP
} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';
import ParameterError from '../common/errors/parameter';

const RoapUtil = {};
const ROAP_ANSWER = _ANSWER_.toLowerCase();

RoapUtil.shouldHandleMedia = (meeting) => {
  const offer =
    meeting.mediaProperties.peerConnection &&
    meeting.mediaProperties.peerConnection.signalingState === SDP.HAVE_LOCAL_OFFER;

  if (offer) {
    return false;
  }

  return true;
};

RoapUtil.handleError = (pc) =>
  PeerConnectionManager.rollBackLocalDescription({peerConnection: pc})
    .then(() => Promise.resolve(true))
    .catch((err) => {
      LoggerProxy.logger.error(`Roap:util#handleError --> ${err}`);

      return Promise.reject(err);
    });

RoapUtil.findError = (messageType, errorType, type) =>
  (type === ROAP.RECEIVE_ROAP_MSG || type === ROAP.SEND_ROAP_MSG) && messageType === _ERROR_ && errorType === _CONFLICT_;

RoapUtil.ensureMeeting = (meeting, type) => {
  if (type === ROAP.RECEIVE_ROAP_MSG || type === ROAP.SEND_ROAP_MSG || type === ROAP.SEND_ROAP_MSG_SUCCESS) {
    if (!meeting) {
      return false;
    }
  }

  return true;
};

RoapUtil.updatePeerConnection = (meeting, session) => PeerConnectionManager.updatePeerConnection({
  offerSdp: session.OFFER.sdps,
  peerConnection: meeting.mediaProperties.peerConnection
},
{
  meetingId: meeting.id,
  remoteQualityLevel: meeting.mediaProperties.remoteQualityLevel
})
  .then((res) => {
    meeting.roap.lastRoapOffer = session.OFFER.sdps;

    return res;
  });


RoapUtil.setRemoteDescription = (meeting, session) => {
  LoggerProxy.logger.info(`Roap:util#setRemoteDescription --> Transmit WAIT_TX_OK, correlationId: ${meeting.correlationId}`);
  if (!(meeting && (meeting.mediaProperties.peerConnection))) {
    LoggerProxy.logger.error(`Roap:util#setRemoteDescription --> DANGER no media or screen peer connection, correlationId: ${meeting.correlationId}`);

    return Promise.reject(new ParameterError('Must provide a media or screen peer connection'));
  }

  return PeerConnectionManager.setRemoteSessionDetails(
    meeting.mediaProperties.peerConnection,
    ROAP_ANSWER,
    session.ANSWER.sdps[0],
    meeting.id
  ).then(() => {
    LoggerProxy.logger.info(`Roap:util#setRemoteDescription --> Success for correlationId: ${meeting.correlationId}`);

    return {
      seq: session.ANSWER.seq,
      locusId: meeting.locusId,
      locusSelfId: meeting.locusInfo.self.id,
      mediaId: meeting.mediaId,
      correlationId: meeting.correlationId
    };
  })
    .catch((err) => {
      LoggerProxy.logger.error(`Roap:util#setRemoteDescription --> ${err}`);
      throw err;
    });
};

export default RoapUtil;

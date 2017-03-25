import {createAction} from 'redux-actions';

export const CALL_CONNECTED = `CALL_CONNECTED`;
export const CALL_DISCONNECTED = `CALL_DISCONNECTED`;
export const CALL_RATED = `CALL_RATED`;
export const CALL_RATING_SKIPPED = `CALL_RATING_SKIPPED`;
export const CALL_STATUS_CHANGED = `CALL_STATUS_CHANGED`;

export const UPDATE_LOCAL_MEDIA = `UPDATE_LOCAL_MEDIA`;
export const updateLocalMedia = createAction(UPDATE_LOCAL_MEDIA);
export const UPDATE_REMOTE_MEDIA = `UPDATE_REMOTE_MEDIA`;
export const updateRemoteMedia = createAction(UPDATE_REMOTE_MEDIA);

// TODO come up with a proper pattern for action creator naming.
export const callConnected = createAction(CALL_CONNECTED);
export const callDisconnected = createAction(CALL_DISCONNECTED);
export const callRated = createAction(CALL_RATED);
export const callRatingSkipped = createAction(CALL_RATING_SKIPPED);
export const callStatusChanged = createAction(CALL_STATUS_CHANGED);

const noop = createAction(`NOOP`);

export const UPDATE_MEDIA_STATE = `UPDATE_MEDIA_STATE`;
const updateMediaState = createAction(UPDATE_MEDIA_STATE);
function createMediaStateUpdateAction(fnName) {
  return (call) => (dispatch) => {
    call[fnName]()
      .then(() => dispatch(updateMediaState(call)));
  };
}

export const startReceivingAudio = createMediaStateUpdateAction(`startReceivingAudio`);
export const startReceivingVideo = createMediaStateUpdateAction(`startReceivingVideo`);
export const startSendingAudio = createMediaStateUpdateAction(`startSendingAudio`);
export const startSendingVideo = createMediaStateUpdateAction(`startSendingVideo`);
export const stopReceivingAudio = createMediaStateUpdateAction(`stopReceivingAudio`);
export const stopReceivingVideo = createMediaStateUpdateAction(`stopReceivingVideo`);
export const stopSendingAudio = createMediaStateUpdateAction(`stopSendingAudio`);
export const stopSendingVideo = createMediaStateUpdateAction(`stopSendingVideo`);

export function bindCallActions(dispatch, call) {
  call.on(`change:status`, () => dispatch(callStatusChanged(call)));
  call.on(`connected`, () => dispatch(callConnected(call)));
  // Reminder: disconnected may have been bound by ring, so can't be bound here
  // TODO consider binding the remaining events in callConnected
  call.on(`remoteMediaStream:change`, () => dispatch(updateRemoteMedia(call)));
  call.on(`localMediaStream:change`, () => dispatch(updateLocalMedia(call)));
  call.on(`change:sendingAudio`, () => dispatch(updateMediaState(call)));
  call.on(`change:receivingAudio`, () => dispatch(updateMediaState(call)));
  call.on(`change:sendingVideo`, () => dispatch(updateMediaState(call)));
  call.on(`change:receivingVideo`, () => dispatch(updateMediaState(call)));
  call.on(`change:localAudioDirection`, () => dispatch(updateMediaState(call)));
  call.on(`change:localVideoDirection`, () => dispatch(updateMediaState(call)));
  call.on(`change:remoteAudioDirection`, () => dispatch(updateMediaState(call)));
  call.on(`change:remoteVideoDirection`, () => dispatch(updateMediaState(call)));
}

export function hangup(call) {
  return (dispatch) => {
    call.hangup();
    dispatch(noop());
  };
}

export function rate(call, rating) {
  return (dispatch) => {
    call.sendFeedback(rating)
      .then(() => dispatch(callRated(call)))
      .catch((reason) => dispatch(callRated(reason)));
  };
}

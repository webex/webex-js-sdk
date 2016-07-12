import {handleActions} from 'redux-actions';
import {pick} from 'lodash';
import {
  CALL_STATUS_CHANGED,
  CALL_CONNECTED,
  UPDATE_MEDIA_STATE,
  UPDATE_REMOTE_MEDIA,
  UPDATE_LOCAL_MEDIA
} from '../actions/call';

const initialState = {
  status: `inactive`
};

function extractMediaState(call) {
  return pick(call,
    `receivingAudio`,
    `receivingVideo`,
    `sendingAudio`,
    `sendingVideo`,
    `localAudioDirection`,
    `localVideoDirection`,
    `remoteMediaStreamUrl`
  );
}

export default handleActions({
  [CALL_STATUS_CHANGED]: (state, action) => Object.assign({}, state, {
    call: action.payload,
    status: action.payload.status
  }, extractMediaState(action.payload)),
  [CALL_CONNECTED]: (state, action) => Object.assign(state, {
    call: action.payload,
    localMediaStreamUrl: action.payload.localMediaStreamUrl,
    remoteMediaStreamUrl: action.payload.remoteMediaStreamUrl,
    remoteName: action.payload.remote.person.name
  }, extractMediaState(action.payload)),
  [UPDATE_MEDIA_STATE]: (state, action) => Object.assign({}, state, extractMediaState(action.payload)),
  [UPDATE_REMOTE_MEDIA]: (state, action) => Object.assign({}, state, extractMediaState(action.payload)),
  [UPDATE_LOCAL_MEDIA]: (state, action) => Object.assign({}, state, extractMediaState(action.payload))
}, initialState);

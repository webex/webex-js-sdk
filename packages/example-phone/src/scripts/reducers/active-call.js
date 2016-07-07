import {handleActions} from 'redux-actions';
import {
  CALL_STATUS_CHANGED,
  CALL_CONNECTED,
  UPDATE_MEDIA_STATE
} from '../actions/call';

const initialState = {
  status: `inactive`
};

export default handleActions({
  [CALL_STATUS_CHANGED]: (state, action) => Object.assign({}, state, {
    call: action.payload,
    status: action.payload.status
  }),
  [CALL_CONNECTED]: (state, action) => Object.assign(state, {
    call: action.payload,
    localMediaStreamUrl: action.payload.localMediaStreamUrl,
    remoteMediaStreamUrl: action.payload.remoteMediaStreamUrl,
    remoteName: action.payload.remote.person.name
  }),
  [UPDATE_MEDIA_STATE]: (state, action) => Object.assign({}, state, action.payload)
}, initialState);

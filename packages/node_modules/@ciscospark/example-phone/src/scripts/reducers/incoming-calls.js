import {handleActions} from 'redux-actions';

import {DECLINE_CALL, RING} from '../actions/incoming-call';
import {CALL_CONNECTED, CALL_DISCONNECTED} from '../actions/call';

const initialState = [];

export default handleActions({
  // Note: this is not particularly efficient
  [CALL_CONNECTED]: (state, action) => state.filter((item) => item.locusUrl !== action.payload.locusUrl),
  [DECLINE_CALL]: (state, action) => state.filter((item) => item.locusUrl !== action.payload.locusUrl),
  [CALL_DISCONNECTED]: (state, action) => state.filter((item) => item.locusUrl !== action.payload.locusUrl),
  [RING]: (state, action) => {
    const prev = state.findIndex((c) => c.locus.url === action.payload.locus.url);
    if (prev === -1) {
      return state.concat(action.payload);
    }

    // I'm fairly confident this will replace the existing item with the
    // incoming one
    return state.slice().splice(prev, 1, action.payload);
  }
}, initialState);

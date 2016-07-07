import {handleActions} from 'redux-actions';

import {
  CALL_DISCONNECTED,
  CALL_RATED,
  CALL_RATING_SKIPPED
} from '../actions/call';

const initialState = null;

export default handleActions({
  [CALL_DISCONNECTED]: (state, action) => action.payload,
  [CALL_RATED]: () => null,
  [CALL_RATING_SKIPPED]: () => null
}, initialState);

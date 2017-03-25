import {handleActions} from 'redux-actions';

import {
  REDUX_SPARK_STATE_UPDATE
} from './actions';

const initialState = {
  authenticated: false,
  authenticating: false,
  connected: false,
  connecting: false
};

export default handleActions({
  [REDUX_SPARK_STATE_UPDATE]: (state, action) => Object.assign({}, state, action.payload)
}, initialState);

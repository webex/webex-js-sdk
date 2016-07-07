import {handleActions} from 'redux-actions';

import {
  REDUX_SPARK_STATE_UPDATE,
  REDUX_SPARK_RECEIVE_CREDENTIALS,
  REDUX_SPARK_RECEIVE_DEVICE
} from './actions';

const initialState = {
  authenticated: false,
  authenticating: false,
  connected: false,
  connecting: false
};

export default handleActions({
  [REDUX_SPARK_STATE_UPDATE]: (state, action) => Object.assign({}, state, action.payload),
  [REDUX_SPARK_RECEIVE_CREDENTIALS]: (state, action) => Object.assign({}, state, {credentials: action.payload}),
  [REDUX_SPARK_RECEIVE_DEVICE]: (state, action) => Object.assign({}, state, {device: action.payload})
}, initialState);

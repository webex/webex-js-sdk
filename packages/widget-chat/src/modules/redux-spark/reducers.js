import {UPDATE_SPARK_STATE} from './actions';

export default function spark(state = {
  authenticated: false,
  authenticating: false,
  connected: false,
  connecting: false
}, action) {
  switch (action.type) {
  case UPDATE_SPARK_STATE:
    return Object.assign({}, state, action.state);
  default:
    return state;
  }
}

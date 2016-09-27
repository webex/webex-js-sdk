import {UPDATE_SPARK_STATE, UPDATE_SPARK_ACCESS_TOKEN} from './actions';

export default function spark(state = {
  authenticated: false,
  authenticating: false,
  registered: false,
  connected: false,
  connecting: false
}, action) {
  switch (action.type) {

  case UPDATE_SPARK_STATE:
    return Object.assign({}, state, action.state);

  case UPDATE_SPARK_ACCESS_TOKEN:
    return Object.assign({}, state, {
      accessToken: action.sparkAccessToken
    });

  default:
    return state;
  }
}

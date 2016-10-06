import {RECEIVE_CURRENT_USER, UPDATE_CURRENT_USER_STATE} from '../actions/user';

function user(state = {
  isFetchingCurrentUser: false
}, action) {
  switch (action.type) {
  case RECEIVE_CURRENT_USER:
    return Object.assign({}, state, {
      isFetchingCurrentUser: action.isFetching,
      currentUser: action.user
    });
  case UPDATE_CURRENT_USER_STATE:
    return Object.assign({}, state, {
      isFetchingCurrentUser: action.state.isFetching
    });
  default:
    return state;
  }
}

export default user;

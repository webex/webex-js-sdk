import {RECEIVE_CURRENT_USER} from '../actions/user';

function user(state = {
  currentUser: {},
  isFetching: false,
  targetUser: {}
}, action) {
  switch (action.type) {
  case RECEIVE_CURRENT_USER:
    return Object.assign({}, state, {
      isFetching: false,
      currentUser: action.user
    });
  default:
    return state;
  }
}

export default user;

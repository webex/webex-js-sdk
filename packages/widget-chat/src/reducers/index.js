import {REQUEST_USER, RECEIVE_USER, RECEIVE_THIS_USER} from '../actions/user';

function user(state = {
  isFetching: false,
  targetUser: {},
  thisUser: {}
}, action) {
  switch (action.type) {
  case REQUEST_USER:
    return Object.assign({}, state, {
      isFetching: true,
      userId: action.userId
    });
  case RECEIVE_USER:
    return Object.assign({}, state, {
      isFetching: false,
      targetUser: action.user,
      userId: action.userId
    });
  case RECEIVE_THIS_USER:
    return Object.assign({}, state, {
      isFetching: false,
      thisUser: action.user
    });
  default:
    return state;
  }
}

export default user;

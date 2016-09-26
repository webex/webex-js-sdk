import {REQUEST_USER, RECEIVE_USER} from '../actions/user';

function user(state = {
  isFetching: false,
  item: {}
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
      item: action.user,
      userId: action.userId
    });
  default:
    return state;
  }
}

export default user;

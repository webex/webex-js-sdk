import {GET_CURRENT_USER, GET_CURRENT_USER_BEGIN} from '../actions/user';

function user(state = {
  isFetchingCurrentUser: false
}, action) {
  switch (action.type) {
  case GET_CURRENT_USER:
    return Object.assign({}, state, {
      isFetchingCurrentUser: action.payload.isFetching,
      currentUser: action.payload.user
    });
  case GET_CURRENT_USER_BEGIN:
    return Object.assign({}, state, {
      isFetchingCurrentUser: action.payload.isFetching
    });
  default:
    return state;
  }
}

export default user;

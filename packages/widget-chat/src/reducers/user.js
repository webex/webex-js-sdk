import {
  ADD_AVATAR_FOR_USER,
  BEGIN_FETCH_AVATAR_FOR_USER,
  RECEIVE_CURRENT_USER,
  UPDATE_CURRENT_USER_STATE
} from '../actions/user';

function user(state = {
  avatars: {},
  avatarsInFlight: [],
  isFetchingCurrentUser: false
}, action) {
  switch (action.type) {
  case ADD_AVATAR_FOR_USER:
    {
      const {userId, avatar} = action;
      const avatarObj = {};
      avatarObj[userId] = avatar;
      const avatars = Object.assign({}, state.avatars, avatarObj);
      const avatarsInFlight = state.avatarsInFlight.filter((inFlightId) => inFlightId !== userId);
      return Object.assign({}, state, {
        avatars,
        avatarsInFlight
      });
    }
  case BEGIN_FETCH_AVATAR_FOR_USER:
    return Object.assign({}, state, {
      avatarsInFlight: [...state.avatarsInFlight, action.userId]
    });
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

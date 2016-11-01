export const ADD_AVATAR_FOR_USER = `ADD_AVATAR_FOR_USER`;
function addAvatarForUserId(userId, avatar) {
  return {
    type: ADD_AVATAR_FOR_USER,
    userId,
    avatar
  };
}

export const BEGIN_FETCH_AVATAR_FOR_USER = `BEGIN_FETCH_AVATAR_FOR_USER`;
function beginFetchAvatarForUser(userId) {
  return {
    type: BEGIN_FETCH_AVATAR_FOR_USER,
    userId
  };
}

export const RECEIVE_CURRENT_USER = `RECEIVE_CURRENT_USER`;
export function receiveCurrentUser(user) {
  return {
    type: RECEIVE_CURRENT_USER,
    isFetching: false,
    user
  };
}

export const UPDATE_CURRENT_USER_STATE = `UPDATE_CURRENT_USER_STATE`;
export function updateCurrentUserState(state) {
  return {
    type: UPDATE_CURRENT_USER_STATE,
    state
  };
}


export function fetchCurrentUser(spark) {
  return (dispatch) => {
    dispatch(updateCurrentUserState({
      isFetching: true
    }));
    spark.user.get()
      .then((user) => {
        dispatch(receiveCurrentUser(user));
      });
  };
}

export function fetchAvatarForUserId(userId, spark) {
  return (dispatch) => {
    dispatch(beginFetchAvatarForUser(userId));
    return spark.avatar.retrieveAvatarUrl(userId)
      .then((avatarUrl) =>
        dispatch(addAvatarForUserId(userId, avatarUrl))
      );
  };
}

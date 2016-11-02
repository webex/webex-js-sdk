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

export const GET_CURRENT_USER = `GET_CURRENT_USER`;
export function getCurrentUser(user) {
  return {
    type: GET_CURRENT_USER,
    payload: {
      isFetching: false,
      user
    }
  };
}

export const GET_CURRENT_USER_BEGIN = `GET_CURRENT_USER_BEGIN`;
export function getCurrentUserBegin() {
  return {
    type: GET_CURRENT_USER_BEGIN,
    payload: {
      isFetching: true
    }
  };
}


export function fetchCurrentUser(spark) {
  return (dispatch) => {
    dispatch(getCurrentUserBegin());
    return spark.user.get()
      .then((user) => {
        dispatch(getCurrentUser(user));
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

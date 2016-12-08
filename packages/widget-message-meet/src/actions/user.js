export const ADD_AVATAR = `ADD_AVATAR`;
function addAvatar(userId, avatar) {
  return {
    type: ADD_AVATAR,
    payload: {
      userId,
      avatar
    }
  };
}

export const ADD_AVATAR_BEGIN = `ADD_AVATAR_BEGIN`;
function addAvatarBegin(userId) {
  return {
    type: ADD_AVATAR_BEGIN,
    payload: {
      userId
    }
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
    dispatch(addAvatarBegin(userId));
    return spark.avatar.retrieveAvatarUrl(userId)
      .then((avatarUrl) =>
        dispatch(addAvatar(userId, avatarUrl))
      );
  };
}

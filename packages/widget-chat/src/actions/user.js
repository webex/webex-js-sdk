export const REQUEST_USER = `REQUEST_USER`;
export function requestUser(userId) {
  return {
    type: REQUEST_USER,
    userId
  };
}

export const RECEIVE_USER = `RECEIVE_USER`;
export function receiveUser(userId, user) {
  return {
    type: RECEIVE_USER,
    userId,
    user
  };
}

export const RECEIVE_CURRENT_USER = `RECEIVE_CURRENT_USER`;
export function receiveCurrentUser(user) {
  return {
    type: RECEIVE_CURRENT_USER,
    user
  };
}


export function fetchCurrentUser(spark) {
  return (dispatch) => {
    spark.user.get()
      .then((user) => {
        dispatch(receiveCurrentUser(user));
      });
  };
}


export function fetchUser(userEmail, spark) {
  return (dispatch) => {
    dispatch(requestUser(userEmail));
    spark.user.getUUID(userEmail)
      .then((user) => dispatch(receiveUser(userEmail, user)));
  };
}

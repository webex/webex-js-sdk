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

export const RECEIVE_THIS_USER = `RECEIVE_THIS_USER`;
export function receiveThisUser(user) {
  return {
    type: RECEIVE_THIS_USER,
    user
  };
}


export function fetchThisUser(spark) {
  return (dispatch) => {
    spark.user.get()
      .then((user) => {
        dispatch(receiveThisUser(user));
      });
  };
}


export function fetchUser(userEmail, spark) {
  return (dispatch) => {
    dispatch(requestUser(userEmail));
    spark.user.getByEmail({email: userEmail})
      .then((user) => dispatch(receiveUser(userEmail, user)));
  };
}

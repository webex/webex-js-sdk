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

export function fetchUser(userId, spark) {
  return (dispatch) => {
    dispatch(requestUser(userId));
    spark.user.asUUID({email: userId})
      .then((response) => {
        console.log(`USERID`);
        console.log(response);
        return response.json();
      })
      .then((user) => dispatch(receiveUser(userId, user)));
  };
}

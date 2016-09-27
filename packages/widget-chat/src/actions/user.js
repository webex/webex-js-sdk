import spark from '../modules/redux-spark/spark.js';

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

export function fetchUser(userId) {
  return (dispatch) => {
    dispatch(requestUser(userId));
    spark.user.asUUID({email: userId})
      .then((response) => response.json())
      .then((user) => dispatch(receiveUser(userId, user)));
  };
}

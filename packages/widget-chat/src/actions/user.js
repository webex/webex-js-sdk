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

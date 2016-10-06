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

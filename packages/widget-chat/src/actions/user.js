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

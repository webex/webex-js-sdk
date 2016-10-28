export const BEGIN_RECEIVE_FLAGS = `BEGIN_RECEIVE_FLAGS`;
export function beginReceiveFlags() {
  return {
    type: BEGIN_RECEIVE_FLAGS
  };
}

export const ADD_FLAG = `ADD_FLAG`;
export function addFlag(flag) {
  return {
    type: ADD_FLAG,
    flag
  };
}

export const RECEIVE_FLAGS = `RECEIVE_FLAGS`;
export function receiveFlags(flags) {
  return {
    type: RECEIVE_FLAGS,
    flags
  };
}

export function fetchFlagsForConversation(conversation, spark) {
  return (dispatch) => {
    dispatch(beginReceiveFlags());
    spark.flag.list()
      .then((flags) => {
        dispatch(receiveFlags(flags));
      });
  };
}

export function flagActivity(activity, spark) {
  return (dispatch) =>
    spark.flag.create(activity)
      .then((flag) => {
        dispatch(addFlag(flag));
      });
}

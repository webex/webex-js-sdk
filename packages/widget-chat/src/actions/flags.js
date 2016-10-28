export const BEGIN_RECEIVE_FLAGS = `BEGIN_RECEIVE_FLAGS`;
function actionBeginReceiveFlags() {
  return {
    type: BEGIN_RECEIVE_FLAGS
  };
}

export const ADD_FLAG = `ADD_FLAG`;
function actionAddFlag(flag) {
  return {
    type: ADD_FLAG,
    flag
  };
}

export const RECEIVE_FLAGS = `RECEIVE_FLAGS`;
function actionReceiveFlags(flags) {
  return {
    type: RECEIVE_FLAGS,
    flags
  };
}

export const REMOVE_FLAG = `REMOVE_FLAG`;
function actionRemoveFlag(flag) {
  return {
    type: REMOVE_FLAG,
    flag
  };
}

export function fetchFlags(spark) {
  return (dispatch) => {
    dispatch(actionBeginReceiveFlags());
    spark.flag.list()
      .then((flags) => {
        dispatch(actionReceiveFlags(flags));
      });
  };
}

export function flagActivity(activity, spark) {
  return (dispatch) =>
    spark.flag.create(activity)
      .then((flag) => {
        dispatch(actionAddFlag(flag));
      });
}

export function removeFlag(flag, spark) {
  return (dispatch) =>
    spark.flag.delete(flag)
      .then(() => {
        dispatch(actionRemoveFlag(flag));
      });
}

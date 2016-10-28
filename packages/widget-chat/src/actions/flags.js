export const ADD_FLAG = `ADD_FLAG`;
function actionAddFlag(activity) {
  return {
    type: ADD_FLAG,
    activity
  };
}

export const BEGIN_RECEIVE_FLAGS = `BEGIN_RECEIVE_FLAGS`;
function actionBeginReceiveFlags() {
  return {
    type: BEGIN_RECEIVE_FLAGS
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

export const REMOVE_FLAG_FAIL = `REMOVE_FLAG_FAIL`;
function actionRemoveFlagFail(flag) {
  return {
    type: REMOVE_FLAG_FAIL,
    flag
  };
}

export const UPDATE_FLAG = `UPDATE_FLAG`;
function actionUpdateFlag(flag) {
  return {
    type: UPDATE_FLAG,
    flag
  };
}

/**
 * Fetches all of the current user's flags
 *
 * @param {any} spark
 * @returns {function}
 */
export function fetchFlags(spark) {
  return (dispatch) => {
    dispatch(actionBeginReceiveFlags());
    spark.flag.list()
      .then((flags) => {
        dispatch(actionReceiveFlags(flags));
      });
  };
}

/**
 * Flags a given activity. Updates state immediately then
 * adds flag details given from api
 *
 * @param {any} activity
 * @param {any} spark
 * @returns {function}
 */
export function flagActivity(activity, spark) {
  return (dispatch) => {
    dispatch(actionAddFlag(activity));
    return spark.flag.create(activity)
      .then((flag) => {
        dispatch(actionUpdateFlag(flag));
      });
  };
}

/**
 * Removes a flag from the server. Updates the state immediately
 * but re-adds it if the delete fails
 *
 * @param {any} flag
 * @param {any} spark
 * @returns {function}
 */
export function removeFlag(flag, spark) {
  return (dispatch) => {
    dispatch(actionRemoveFlag(flag));
    return spark.flag.delete(flag)
      .catch(() => {
        dispatch(actionRemoveFlagFail(flag));
      });
  };
}

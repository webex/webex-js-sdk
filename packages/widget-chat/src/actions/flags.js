export const ADD_FLAG_BEGIN = `ADD_FLAG_BEGIN`;
function addFlagBegin(activity) {
  return {
    type: ADD_FLAG_BEGIN,
    payload: {
      activity
    }
  };
}

export const ADD_FLAG = `ADD_FLAG`;
function addFlagSuccess(activity, flag) {
  return {
    type: ADD_FLAG,
    payload: {
      activity,
      flag
    }
  };
}

function addFlagError(activity, error) {
  return {
    type: ADD_FLAG,
    payload: {
      activity,
      error
    },
    error: true
  };
}

export const FLAGS_REQUEST_BEGIN = `FLAGS_REQUEST_BEGIN`;
function flagsRequestBegin() {
  return {
    type: FLAGS_REQUEST_BEGIN
  };
}

export const FLAGS_REQUEST = `FLAGS_REQUEST`;
function flagsRequestSuccess(flags) {
  return {
    type: FLAGS_REQUEST,
    payload: {
      flags
    }
  };
}

function flagsRequestError(error) {
  return {
    type: FLAGS_REQUEST,
    payload: error,
    error: true
  };
}

export const REMOVE_FLAG = `REMOVE_FLAG`;
function removeFlagBegin(flag) {
  return {
    type: REMOVE_FLAG,
    payload: {
      flag
    }
  };
}

function removeFlagError(error, flag) {
  return {
    type: REMOVE_FLAG,
    payload: {
      error,
      flag
    },
    error: true
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
    dispatch(flagsRequestBegin());
    return spark.flag.list()
      .then((flags) =>
        dispatch(flagsRequestSuccess(flags))
      )
      .catch((error) =>
        dispatch(flagsRequestError(error))
      );
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
    dispatch(addFlagBegin(activity));
    return spark.flag.create(activity)
      .then((flag) =>
        dispatch(addFlagSuccess(activity, flag))
      )
      .catch((error) =>
        dispatch(addFlagError(activity, error))
      );
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
export function removeFlagFromServer(flag, spark) {
  return (dispatch) => {
    dispatch(removeFlagBegin(flag));
    return spark.flag.delete(flag)
      .catch((error) => {
        dispatch(removeFlagError(error, flag));
      });
  };
}

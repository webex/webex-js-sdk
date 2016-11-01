export const FETCH_SHARE = `FETCH_SHARE`;
export function fetchShare(fileObject) {
  return {
    type: FETCH_SHARE,
    payload: {
      fileObject
    }
  };
}

export const RECEIVE_SHARE = `RECEIVE_SHARE`;
export function receiveShare(payload, error) {
  return {
    type: RECEIVE_SHARE,
    payload,
    error
  };
}

export function retrieveSharedFile(fileObject, spark) {
  return (dispatch) => {
    dispatch(fetchShare(fileObject));
    return spark.conversation.download(fileObject)
      .then((file) => {
        dispatch(receiveShare({file, fileObject}, false));
        return file;
      }, (error) => {
        dispatch(receiveShare(error, true));
      });
  };
}

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
export function receiveShare(payload) {
  return {
    type: RECEIVE_SHARE,
    payload
  };
}

export const STORE_SHARES = `STORE_SHARES`;
export function storeShares(shares) {
  return {
    type: STORE_SHARES,
    payload: {
      shares
    }
  };
}


export function retrieveSharedFile(fileObject, spark) {
  return (dispatch) => {
    dispatch(fetchShare(fileObject));
    return spark.conversation.download(fileObject)
      .then((file) => {
        dispatch(receiveShare({file, fileObject}, false));
        return file;
      });
  };
}

export function uploadFiles(conversation, activity, files, spark) {
  return (dispatch) => {
    const shareActivity = spark.conversation.makeShare(conversation);
    return Promise.resolve(shareActivity)
      .then((share) => Promise.all(files.map((file) => share.add(file))))
      .then((uploadedShares) => {
        dispatch(storeShares(uploadedShares));
      });
  };
}

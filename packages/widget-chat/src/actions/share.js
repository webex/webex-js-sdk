import saveAs from 'browser-saveas';

export const RECEIVE_SHARE = `RECEIVE_SHARE`;
export function receiveShare(file, fileObject) {
  return {
    type: RECEIVE_SHARE,
    file,
    fileObject
  };
}

export const UPDATE_SHARE_STATUS = `UPDATE_SHARE_STATUS`;
export function updateShareStatus(fileObject, status) {
  return {
    type: UPDATE_SHARE_STATUS,
    fileObject,
    status
  };
}

export function retrieveSharedFile(fileObject, spark) {
  return (dispatch) => {
    dispatch(updateShareStatus(fileObject, {isDownloading: true}));
    return spark.conversation.download(fileObject)
      .then((file) => {
        dispatch(updateShareStatus(fileObject, {isDownloading: false}));
        dispatch(receiveShare(file, fileObject));
        return file;
      });
  };
}

export const SAVE_SHARE = `SAVE_SHARE`;
export function saveShare(file, fileObject) {
  return {
    type: SAVE_SHARE,
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


export function downloadSharedFile(fileObject, spark) {
  return (dispatch) => {
    dispatch(updateShareStatus(fileObject, {isDownloading: true}));
    spark.conversation.download(fileObject)
      .then((file) => {
        dispatch(updateShareStatus(fileObject, {isDownloading: false}));
        dispatch(saveShare(file, fileObject));
      });
  };
}

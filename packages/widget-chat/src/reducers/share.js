import {bufferToBlob} from '../utils/files';

import {
  RECEIVE_SHARE,
  FETCH_SHARE
} from '../actions/share';

export default function reduceShare(state = {
  files: {}
}, action) {
  switch (action.type) {

  case RECEIVE_SHARE: {
    const {
      file,
      fileObject
    } = action.payload;
    const {blob, objectUrl} = bufferToBlob(file);
    const key = fileObject.url;

    return Object.assign({}, state, {
      files: Object.assign({}, state.files, {
        [key]: Object.assign({}, state.files[key], {
          name: fileObject.displayName,
          mimeType: fileObject.mimeType,
          fileSize: fileObject.fileSize,
          isFetching: false,
          blob,
          objectUrl
        })
      })
    });
  }

  case FETCH_SHARE: {
    const key = action.payload.fileObject.url;
    return Object.assign({}, state, {
      files: Object.assign({}, state.files, {
        [key]: Object.assign({}, state.files[key], {
          isFetching: true
        })
      })
    });
  }

  default: {
    return state;
  }
  }
}

import {bufferToBlob} from '../utils/files';

import {
  RECEIVE_SHARE,
  UPDATE_SHARE_STATUS
} from '../actions/share';

export default function reduceShare(state = {
  files: {}
}, action) {
  switch (action.type) {

  case RECEIVE_SHARE: {
    const {blob, objectUrl} = bufferToBlob(action.file);
    const key = action.fileObject.url;

    return Object.assign({}, state, {
      files: Object.assign({}, state.files, {
        [key]: Object.assign({}, state.files[key], {
          name: action.fileObject.displayName,
          mimeType: action.fileObject.mimeType,
          fileSize: action.fileObject.fileSize,
          blob,
          objectUrl
        })
      })
    });
  }

  case UPDATE_SHARE_STATUS: {
    const key = action.fileObject.url;
    return Object.assign({}, state, {
      files: Object.assign({}, state.files, {
        [key]: Object.assign({}, state.files[key], {
          status: action.status
        })
      })
    });
  }

  default: {
    return state;
  }
  }
}

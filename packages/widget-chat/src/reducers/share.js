import {
  SAVE_SHARE,
  UPDATE_SHARE_STATUS
} from '../actions/share';

export default function reduceShare(state = {
  files: {}
}, action) {
  switch (action.type) {
  case SAVE_SHARE: {
    const urlCreator = window.URL || window.webkitURL;
    const blob = new Blob([action.file], {type: action.file.type});
    const objectUrl = urlCreator.createObjectURL(blob);
    return Object.assign({}, state, {
      files: Object.assign({}, state.files, {
        [action.fileObject.url]: {
          blob,
          objectUrl
        }
      })
    });
  }

  case UPDATE_SHARE_STATUS: {
    return Object.assign({}, state, {
      files: Object.assign({}, state.files,
        Object.assign({}, state.files[action.fileObject.url], {
          [action.fileObject.url]: {
            isDownloading: action.isDownloading
          }
        })
      )
    });
  }

  default: {
    return state;
  }
  }
}

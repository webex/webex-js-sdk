import {Map, OrderedMap} from 'immutable';

import {bufferToBlob} from '../utils/files';

import {
  FETCH_SHARE,
  RECEIVE_SHARE,
  STORE_SHARES
} from '../actions/share';

export default function reduceShare(state = new Map({
  files: new OrderedMap({})
}), action) {
  switch (action.type) {

  case RECEIVE_SHARE: {
    const {
      file,
      fileObject
    } = action.payload;
    const {blob, objectUrl} = bufferToBlob(file);
    const key = fileObject.url;

    return state.setIn([`files`, key], new Map({
      name: fileObject.displayName,
      mimeType: fileObject.mimeType,
      fileSize: fileObject.fileSize,
      isFetching: false,
      blob,
      objectUrl
    }));
  }

  case STORE_SHARES: {
    return state;
  }

  case FETCH_SHARE: {
    const key = action.payload.fileObject.url;
    return state.setIn([`files`, key, `isFetching`], true);
  }

  default: {
    return state;
  }
  }
}

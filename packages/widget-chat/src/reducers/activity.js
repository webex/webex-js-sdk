import {Map, OrderedMap} from 'immutable';

import {
  ADD_FILES_TO_ACTIVITY,
  RESET_ACTIVITY,
  SAVE_SHARE_ACTIVITY,
  UPDATE_ACTIVITY_STATUS,
  UPDATE_ACTIVITY_TEXT
} from '../actions/activity';

const initialState = new Map({
  status: new Map({
    isSending: false
  }),
  files: new OrderedMap(),
  text: ``
});

export default function reduceActivity(state = initialState, action) {
  switch (action.type) {
  case ADD_FILES_TO_ACTIVITY: {
    const files = action.payload.files.reduce((o, currentFile) => {
      o[currentFile.id] = currentFile;
      return o;
    }, {});

    return state.mergeDeepIn([`files`], files);
  }

  case RESET_ACTIVITY: {
    return initialState;
  }

  case SAVE_SHARE_ACTIVITY: {
    return state.set(`shareActivity`, action.payload.shareActivity);
  }

  case UPDATE_ACTIVITY_STATUS:
    return state.mergeDeepIn([`status`], action.payload.status);

  case UPDATE_ACTIVITY_TEXT:
    return state.set(`text`, action.payload.text);

  default:
    return state;
  }
}

import {Map, OrderedMap} from 'immutable';
import uuid from 'uuid';

import {
  ADD_FILES_TO_ACTIVITY,
  RESET_ACTIVITY,
  REMOVE_FILE_FROM_ACTIVITY,
  SAVE_SHARE_ACTIVITY,
  SUBMIT_ACTIVITY_START,
  UPDATE_ACTIVITY_STATUS,
  UPDATE_ACTIVITY_TEXT
} from '../actions/activity';

export const initialState = new Map({
  activity: new Map({
    clientTempId: uuid.v4(),
    object: new Map()
  }),
  files: new OrderedMap(),
  shareActivity: undefined,
  status: new Map({
    isSending: false,
    isTyping: false
  }),
  text: ``
});

// eslint-disable-reason lots of actions for activities
// eslint-disable-next-line complexity
export default function reduceActivity(state = initialState, action) {
  switch (action.type) {
  case ADD_FILES_TO_ACTIVITY: {
    const files = action.payload.files.reduce((o, currentFile) => {
      o[currentFile.id] = currentFile;
      return o;
    }, {});

    return state.mergeIn([`files`], files);
  }

  case REMOVE_FILE_FROM_ACTIVITY: {
    return state.deleteIn([`files`, action.payload.id]);
  }

  case RESET_ACTIVITY: {
    return initialState.setIn([`activity`, `clientTempId`], uuid.v4());
  }

  case SAVE_SHARE_ACTIVITY: {
    return state.setIn([`shareActivity`], action.payload.shareActivity);
  }

  case SUBMIT_ACTIVITY_START: {
    return state
      // Store the activity as an in flight activity before sending
      // .setIn(`inFlightActivity`, action.payload.activity)
      // Clear the text from the input
      .set(`text`, ``)
      .setIn([`status`, `isSending`], true);
  }

  case UPDATE_ACTIVITY_STATUS:
    return state.mergeDeepIn([`status`], action.payload.status);

  case UPDATE_ACTIVITY_TEXT:
    return state.set(`text`, action.payload.text);

  default:
    return state;
  }
}

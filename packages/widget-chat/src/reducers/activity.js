import {Map} from 'immutable';

import {constructFile} from '../utils/files';
import {
  constructActivity
} from '../utils/activity';

import {
  ADD_FILES_TO_ACTIVITY,
  CREATE_ACTIVITY,
  UPDATE_ACTIVITY_STATUS,
  UPDATE_ACTIVITY_TEXT
} from '../actions/activity';

function constructFiles(files) {
  return files.map((file) => constructFile(file));
}

export default function reduceActivity(state = new Map({
  status: new Map({
    isSending: false
  }),
  activity: new Map()
}), action) {
  switch (action.type) {
  case ADD_FILES_TO_ACTIVITY: {
    if (state.getIn([`activity`, `files`])) {
      return state.updateIn([`activity`, `files`, `items`], (files) => files.concat(constructFiles(action.payload.files)));
    }
    return state.mergeDeepIn([`activity`], {
      object: {
        objectType: `content`
      },
      verb: `share`,
      files: {
        items: constructFiles(action.payload.files)
      }
    });
  }
  case CREATE_ACTIVITY: {
    const {
      actor,
      conversation,
      text
    } = action.payload;
    return state.mergeDeepIn([`activity`], constructActivity(conversation, text, actor));
  }
  case UPDATE_ACTIVITY_STATUS:
    return state.mergeDeep({
      status: action.payload.status
    });
  case UPDATE_ACTIVITY_TEXT:
    return state.setIn([`activity`, `object`, `displayName`], action.payload.text);
  default:
    return state;
  }
}

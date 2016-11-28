import {Map} from 'immutable';

import {constructActivity} from '../utils/activity';
import {
  CREATE_ACTIVITY,
  UPDATE_ACTIVITY_STATUS,
  UPDATE_ACTIVITY_TEXT
} from '../actions/activity';

export default function reduceActivity(state = new Map({
  status: new Map({
    isSending: false
  }),
  activity: new Map()
}), action) {
  switch (action.type) {
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

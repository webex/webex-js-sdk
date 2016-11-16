import {constructActivity} from '../utils/activity';
import {
  ADD_FILES_TO_ACTIVITY,
  CREATE_ACTIVITY,
  UPDATE_ACTIVITY_STATE,
  UPDATE_ACTIVITY_TEXT
} from '../actions/activity';

export default function reduceActivity(state = {
  status: {
    isSending: false
  }
}, action) {
  switch (action.type) {
  case ADD_FILES_TO_ACTIVITY: {
    const newState = Object.assign({}, state);
    if (!state.activity.files) {
      newState.activity.files = [];
    }
    newState.activity.files.concat(action.files);
    return newState;
  }
  case CREATE_ACTIVITY: {
    const {
      actor,
      conversation,
      text
    } = action.payload;
    return Object.assign({}, state, {
      activity: constructActivity(conversation, text, actor)
    });
  }
  case UPDATE_ACTIVITY_STATE:
    return Object.assign({}, state, {
      status: action.payload.state
    });
  case UPDATE_ACTIVITY_TEXT:
    return Object.assign({}, state, {
      activity: Object.assign({}, state.activity, {
        object: Object.assign({}, state.activity.object, {
          displayName: action.payload.text
        })
      })
    });
  default:
    return state;
  }
}

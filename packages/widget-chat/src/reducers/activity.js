import {constructActivity} from '../utils/activity';
import {
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

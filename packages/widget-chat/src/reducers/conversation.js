import {CREATE_CONVERSATION, RECEIVE_CONVERSATION} from '../actions/conversation';

function conversation(state = {
  activities: [],
  id: null,
  participants: [],
  isFetching: false,
  isLoaded: false
}, action) {
  switch (action.type) {

  case CREATE_CONVERSATION:
    return Object.assign({}, state, {
      isFetching: true
    });

  case RECEIVE_CONVERSATION: {
    return Object.assign({}, state, {
      isFetching: false,
      activities: action.conversation.activities.items,
      id: action.conversation.id,
      participants: action.conversation.participants.items,
      isLoaded: true
    });
  }

  default:
    return state;
  }
}

export default conversation;

import {CREATE_CONVERSATION, RECEIVE_CONVERSATION} from '../actions/conversation';

function conversation(state = {
  isFetching: false,
  conversation: {}
}, action) {
  switch (action.type) {
  case CREATE_CONVERSATION:
    return Object.assign({}, state, {
      isFetching: true,
      userId: action.userId
    });
  case RECEIVE_CONVERSATION:
    return Object.assign({}, state, {
      isFetching: false,
      userId: action.userId,
      conversation: action.conversation
    });
  default:
    return state;
  }
}

export default conversation;

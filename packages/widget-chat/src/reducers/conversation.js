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
  case RECEIVE_CONVERSATION: {
    const reducedConversation = {
      id: action.conversation.id,
      participants: action.conversation.participants
    };
    return Object.assign({}, state, {
      isFetching: false,
      userId: action.userId,
      conversation: reducedConversation
    });
  }
  default:
    return state;
  }
}

export default conversation;

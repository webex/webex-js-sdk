import {CREATE_CONVERSATION, RECEIVE_CONVERSATION} from '../actions/conversation';

export default function conversation(state = {
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

    const activities = action.conversation.activities.items.map((activity) => ({
      id: activity.id,
      content: activity.object.displayName
    }));

    return Object.assign({}, state, {
      activities,
      isFetching: false,
      isLoaded: true,
      id: action.conversation.id,
      participants: action.conversation.participants.items
    });
  }

  default:
    return state;
  }
}

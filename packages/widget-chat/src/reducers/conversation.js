import {
  CREATE_CONVERSATION,
  RECEIVE_CONVERSATION,
  RECEIVE_MERCURY_ACTIVITY,
  UPDATE_MERCURY_STATE
} from '../actions/conversation';

export default function conversation(state = {
  activities: [],
  id: null,
  participants: [],
  isFetching: false,
  isLoaded: false,
  mercuryState: {
    isListening: false
  }
}, action) {
  switch (action.type) {

  case CREATE_CONVERSATION: {
    return Object.assign({}, state, {
      isFetching: true
    });
  }

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

  case RECEIVE_MERCURY_ACTIVITY: {
    const activities = state.activities;
    const activity = {
      id: action.activity.id,
      content: action.activity.object.displayName
    };
    return Object.assign({}, state, {
      activities: [...activities, activity]
    });
  }

  case UPDATE_MERCURY_STATE: {
    return Object.assign({}, state, {
      mercuryState: action.mercuryState
    });
  }

  default: {
    return state;
  }
  }
}

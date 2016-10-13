import {formatDate} from '../utils/date';

import {
  CREATE_CONVERSATION,
  RECEIVE_CONVERSATION,
  RECEIVE_MERCURY_ACTIVITY,
  UPDATE_MERCURY_STATE,
  UPDATE_SHOULD_SCROLL
} from '../actions/conversation';


function formatActivity(activity) {
  return {
    id: activity.id,
    content: activity.object.displayName,
    name: activity.actor.displayName,
    actorId: activity.actor.id,
    timestamp: formatDate(activity.published),
    verb: activity.verb
  };
}


export default function conversation(state = {
  activities: [],
  id: null,
  participants: [],
  isFetching: false,
  isLoaded: false,
  shouldScroll: true,
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
    const activities = action.conversation.activities.items.map(formatActivity);

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
    const activity = formatActivity(action.activity);
    return Object.assign({}, state, {
      activities: [...activities, activity]
    });
  }

  case UPDATE_MERCURY_STATE: {
    return Object.assign({}, state, {
      mercuryState: action.mercuryState
    });
  }

  case UPDATE_SHOULD_SCROLL: {
    return Object.assign({}, state, {
      shouldScroll: action.shouldScroll
    });
  }

  default: {
    return state;
  }
  }
}

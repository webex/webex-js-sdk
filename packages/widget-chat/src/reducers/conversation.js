import {
  CREATE_CONVERSATION,
  RECEIVE_CONVERSATION,
  RECEIVE_MERCURY_ACTIVITY,
  RECEIVE_MERCURY_COMMENT,
  UPDATE_MERCURY_STATE
} from '../actions/conversation';

const filteredActivities = [`delete`];

function filterActivity(activity) {
  return filteredActivities.indexOf(activity.verb) === -1;
}


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
    const activities = action.conversation.activities.items.filter(filterActivity);

    return Object.assign({}, state, {
      activities,
      isFetching: false,
      isLoaded: true,
      id: action.conversation.id,
      participants: action.conversation.participants.items
    });
  }
  case RECEIVE_MERCURY_ACTIVITY: {
    let activities = state.activities;
    if (action.activity.verb === `delete`) {
      // Find activity that is being deleted and change it to a tombstone
      const deletedId = action.activity.object.id;
      activities = state.activities.map((activity) => {
        if (activity.id === deletedId) {
          return Object.assign({}, activity, {
            verb: `tombstone`
          });
        }
        return activity;
      });
    }
    return Object.assign({}, state, {
      activities: [...activities]
    });
  }

  case RECEIVE_MERCURY_COMMENT: {
    const activities = state.activities;
    const activity = action.activity;
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

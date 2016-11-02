/* eslint complexity: ["error", 10] */
// Refactoring and splitting up reducer in next feature
import _ from 'lodash';

import {
  ADD_ACTIVITIES_TO_CONVERSATION,
  CREATE_CONVERSATION,
  RECEIVE_CONVERSATION,
  RECEIVE_MERCURY_ACTIVITY,
  RECEIVE_MERCURY_COMMENT,
  UPDATE_CONVERSATION_STATE,
  UPDATE_MERCURY_STATE
} from '../actions/conversation';

const filteredActivities = [`delete`];

function filterActivity(activity) {
  return filteredActivities.indexOf(activity.verb) === -1;
}

function sortActivityByTime(activities) {
  activities = _.uniqBy(activities, `id`);
  return _.sortBy(activities, [`published`]);
}


export default function reduceConversation(state = {
  activities: [],
  id: null,
  participants: [],
  isFetching: false,
  isLoaded: false,
  isLoadingHistoryUp: false,
  mercuryState: {
    isListening: false
  }
}, action) {
  switch (action.type) {
  case ADD_ACTIVITIES_TO_CONVERSATION: {
    const activities = [...action.payload.activities, ...state.activities];
    return Object.assign({}, state, {
      activities: sortActivityByTime(activities)
    });
  }

  case CREATE_CONVERSATION: {
    return Object.assign({}, state, {
      isFetching: true
    });
  }

  case RECEIVE_CONVERSATION: {
    const activities = action.payload.conversation.activities.items.filter(filterActivity);

    return Object.assign({}, state, {
      activities,
      isFetching: false,
      isLoaded: true,
      id: action.payload.conversation.id,
      participants: action.payload.conversation.participants.items
    });
  }

  case RECEIVE_MERCURY_ACTIVITY: {
    let activities = state.activities;
    if (action.payload.activity.verb === `delete`) {
      // Find activity that is being deleted and change it to a tombstone
      const deletedId = action.payload.activity.object.id;
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
    const activity = action.payload.activity;
    return Object.assign({}, state, {
      activities: [...activities, activity]
    });
  }

  case UPDATE_CONVERSATION_STATE: {
    return Object.assign({}, state, action.payload.conversationState);
  }

  case UPDATE_MERCURY_STATE: {
    return Object.assign({}, state, {
      mercuryState: action.payload.mercuryState
    });
  }

  default: {
    return state;
  }
  }
}

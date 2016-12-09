/* eslint complexity: ["error", 10] */
// Refactoring and splitting up reducer in next feature
import _ from 'lodash';

import {
  ACKNOWLEDGE_ACTIVITY,
  ADD_ACTIVITIES_TO_CONVERSATION,
  CREATE_CONVERSATION,
  CREATE_CONVERSATION_BEGIN,
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

function receiveMercuryActivity(state, action) {
  let {activities, participants} = state;
  const {activity} = action.payload;
  const {verb} = activity;
  if (verb === `delete`) {
    // Find activity that is being deleted and change it to a tombstone
    const deletedId = activity.object.id;
    activities = state.activities.map((activityItem) => {
      if (activityItem.id === deletedId) {
        return Object.assign({}, activityItem, {
          verb: `tombstone`
        });
      }
      return activityItem;
    });
  }
  else if (verb === `acknowledge`) {
    // acknowledge is a read receipt. we need to update the participants who
    // are listed in this acknowledgement
    const actorId = activity.actor.id;
    participants = state.participants.map((participant) => {
      if (participant.id === actorId) {
        return Object.assign({}, participant, {
          roomProperties: Object.assign({}, participant.roomProperties, {
            lastSeenActivityUUID: activity.object.id,
            lastSeenActivityDate: activity.published
          })
        });
      }
      return participant;
    });
  }
  return Object.assign({}, state, {
    activities: [...activities],
    participants: [...participants]
  });
}


export default function reduceConversation(state = {
  activities: [],
  id: null,
  lastAcknowledgedActivityId: null,
  isFetching: false,
  isLoaded: false,
  isLoadingHistoryUp: false,
  mercuryState: {
    isListening: false
  },
  participants: []
}, action) {
  switch (action.type) {
  case ACKNOWLEDGE_ACTIVITY: {
    const activityId = action.payload.activity.id;
    return Object.assign({}, state, {
      lastAcknowledgedActivityId: activityId
    });
  }
  case ADD_ACTIVITIES_TO_CONVERSATION: {
    const activities = [...action.payload.activities, ...state.activities];
    return Object.assign({}, state, {
      activities: sortActivityByTime(activities)
    });
  }

  case CREATE_CONVERSATION_BEGIN: {
    return Object.assign({}, state, {
      isFetching: true
    });
  }

  case CREATE_CONVERSATION: {
    const {
      defaultActivityEncryptionKeyUrl,
      id,
      kmsResourceObjectUrl,
      participants,
      url
    } = action.payload.conversation;

    const activities = action.payload.conversation.activities.items.filter(filterActivity);

    return Object.assign({}, state, {
      activities,
      defaultActivityEncryptionKeyUrl,
      id,
      kmsResourceObjectUrl,
      url,
      isFetching: false,
      isLoaded: true,
      participants: participants.items
    });
  }

  case RECEIVE_MERCURY_ACTIVITY: {
    return receiveMercuryActivity(state, action);
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

import {updateHasNewMessage} from './widget.js';
import {setTyping} from './indicators';

const VISIBLE_ACTIVITY_VERBS = [`share`, `post`];
const VISIBLE_ACTIVITY_TYPES = [`comment`, `content`, `conversation`];

export const ACKNOWLEDGE_ACTIVITY = `ACKNOWLEDGE_ACTIVITY`;
function acknowledgeActivity(activity) {
  return {
    type: ACKNOWLEDGE_ACTIVITY,
    payload: {
      activity
    }
  };
}

export const ADD_ACTIVITIES_TO_CONVERSATION = `ADD_ACTIVITIES_TO_CONVERSATION`;
export function addActivitiesToConversation(activities) {
  return {
    type: ADD_ACTIVITIES_TO_CONVERSATION,
    payload: {
      activities
    }
  };
}

export const CREATE_CONVERSATION_BEGIN = `CREATE_CONVERSATION_BEGIN`;
export function createConversationBegin(userId) {
  return {
    type: CREATE_CONVERSATION_BEGIN,
    payload: {
      userId
    }
  };
}

export const CREATE_CONVERSATION = `CREATE_CONVERSATION`;
export function createConversation(conversation) {
  return {
    type: CREATE_CONVERSATION,
    payload: {
      conversation
    }
  };
}

export const DELETE_ACTIVITY_FROM_CONVERSATION = `DELETE_ACTIVITY_FROM_CONVERSATION`;
export function deleteActivityFromConversation(conversation, activity) {
  return {
    type: DELETE_ACTIVITY_FROM_CONVERSATION,
    payload: {
      conversation,
      activity
    }
  };
}

export const RECEIVE_MERCURY_COMMENT = `RECEIVE_MERCURY_COMMENT`;
export function receiveMercuryComment(activity) {
  return {
    type: RECEIVE_MERCURY_COMMENT,
    payload: {
      activity
    }
  };
}

export const RECEIVE_MERCURY_ACTIVITY = `RECEIVE_MERCURY_ACTIVITY`;
export function receiveMercuryActivity(activity) {
  return {
    type: RECEIVE_MERCURY_ACTIVITY,
    payload: {
      activity
    }
  };
}

export const UPDATE_MERCURY_STATE = `UPDATE_MERCURY_STATE`;
export function updateMercuryState(mercuryState) {
  return {
    type: UPDATE_MERCURY_STATE,
    payload: {
      mercuryState
    }
  };
}

export const UPDATE_CONVERSATION_STATE = `UPDATE_CONVERSATION_STATE`;
export function updateConversationState(conversationState) {
  return {
    type: UPDATE_CONVERSATION_STATE,
    payload: {
      conversationState
    }
  };
}


export function acknowledgeActivityOnServer(conversation, activity, spark) {
  return (dispatch) =>
    spark.conversation.acknowledge({
      id: conversation.id
    }, {
      id: activity.id
    }).then(() => dispatch(acknowledgeActivity(activity)));
}

/**
 * Creates/Opens a conversation with a user
 *
 * @param {String} userId Either UUID or email of user
 * @param {object} spark
 * @returns {function}
 */
export function createConversationWithUser(userId, spark) {
  return (dispatch) => {
    dispatch(createConversationBegin(userId));

    spark.conversation.create({
      participants: [userId]
    }, {
      latestActivity: true,
      activitiesLimit: 30,
      participantAckFilter: `all`
    })
      .then((conversation) => dispatch(createConversation(conversation)));
  };
}

export function deleteActivity(conversation, activity, spark) {
  return (dispatch) =>
    spark.conversation.delete(conversation, activity)
      .then(() => {
        dispatch(deleteActivityFromConversation(conversation, activity));
      });
}

export function listenToMercuryActivity(conversationId, spark) {
  return (dispatch) => {
    dispatch(updateMercuryState({isListening: true}));
    spark.mercury.on(`event:status.start_typing`, (event) => {
      if (event.data.conversationId === conversationId) {
        dispatch(setTyping(event.data.actor.id, true));
      }
    });

    spark.mercury.on(`event:status.stop_typing`, (event) => {
      if (event.data.conversationId === conversationId) {
        dispatch(setTyping(event.data.actor.id, false));
      }
    });

    spark.mercury.on(`event:conversation.activity`, (event) => {
      const activity = event.data.activity;
      const isVisibleContent = VISIBLE_ACTIVITY_VERBS.indexOf(activity.verb) !== -1 && VISIBLE_ACTIVITY_TYPES.indexOf(activity.object.objectType) !== -1;
      // Ignore activity from other conversations
      if (activity.target.id === conversationId) {
        if (isVisibleContent) {
          dispatch(updateHasNewMessage(true));
          dispatch(receiveMercuryComment(activity));
        }
        else if (activity.object.objectType === `activity`) {
          dispatch(receiveMercuryActivity(activity));
        }
      }
    });
  };
}

export function loadPreviousMessages(converstationId, lastActivity, spark) {
  return (dispatch) => {
    dispatch(updateConversationState({isLoadingHistoryUp: true}));
    spark.conversation.listActivities({
      conversationId: converstationId,
      limit: 20,
      maxDate: lastActivity.published
    })
    .then((activities) => {
      dispatch(addActivitiesToConversation(activities));
      dispatch(updateConversationState({isLoadingHistoryUp: false}));
    });
  };
}

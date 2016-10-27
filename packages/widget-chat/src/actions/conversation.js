import {updateHasNewMessage} from './widget.js';
import {setTyping} from './indicators';

export const CREATE_CONVERSATION = `CREATE_CONVERSATION`;
export function createConversation(userId) {
  return {
    type: CREATE_CONVERSATION,
    userId
  };
}

export const DELETE_ACTIVITY_FROM_CONVERSATION = `DELETE_ACTIVITY_FROM_CONVERSATION`;
export function deleteActivityFromConversation(conversation, activity) {
  return {
    type: DELETE_ACTIVITY_FROM_CONVERSATION,
    conversation,
    activity
  };
}

export const FLAG_ACTIVITY_IN_CONVERSATION = `FLAG_ACTIVITY_IN_CONVERSATION`;
export function flagActivityInConversation(conversation, activity) {
  return {
    type: FLAG_ACTIVITY_IN_CONVERSATION,
    conversation,
    activity
  };
}

export const RECEIVE_CONVERSATION = `RECEIVE_CONVERSATION`;
export function receiveConversation(conversation) {
  return {
    type: RECEIVE_CONVERSATION,
    conversation
  };
}

export const RECEIVE_MERCURY_COMMENT = `RECEIVE_MERCURY_COMMENT`;
export function receiveMercuryComment(activity) {
  return {
    type: RECEIVE_MERCURY_COMMENT,
    activity
  };
}

export const RECEIVE_MERCURY_ACTIVITY = `RECEIVE_MERCURY_ACTIVITY`;
export function receiveMercuryActivity(activity) {
  return {
    type: RECEIVE_MERCURY_ACTIVITY,
    activity
  };
}

export const UPDATE_MERCURY_STATE = `UPDATE_MERCURY_STATE`;
export function updateMercuryState(mercuryState) {
  return {
    type: UPDATE_MERCURY_STATE,
    mercuryState
  };
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
    dispatch(createConversation(userId));

    spark.conversation.create({
      participants: [userId]
    }, {
      latestActivity: true,
      activitiesLimit: 30
    })
      .then((conversation) => dispatch(receiveConversation(conversation)));
  };
}

export function deleteActivity(conversation, activity, spark) {
  return (dispatch) =>
    spark.conversation.delete(conversation, activity)
      .then(() => {
        dispatch(deleteActivityFromConversation(conversation, activity));
      });
}

export function flagActivity(conversation, activity, spark) {
  return (dispatch) =>
    spark.flag.create(activity)
      .then(() => {
        dispatch(flagActivityInConversation(conversation, activity));
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
      const isChatMessage = activity.verb === `post` && activity.object.objectType === `comment` && activity.target.objectType === `conversation`;
      // Ignore activity from other conversations
      if (activity.target.id === conversationId) {
        if (isChatMessage) {
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

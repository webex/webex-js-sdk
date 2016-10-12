export const CREATE_CONVERSATION = `CREATE_CONVERSATION`;
export function createConversation(userId) {
  return {
    type: CREATE_CONVERSATION,
    userId
  };
}

export const RECEIVE_CONVERSATION = `RECEIVE_CONVERSATION`;
export function receiveConversation(conversation) {
  return {
    type: RECEIVE_CONVERSATION,
    conversation
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

export const UPDATE_SHOULD_SCROLL = `UPDATE_SHOULD_SCROLL`;
export function updateShouldScroll(shouldScroll) {
  return {
    type: UPDATE_SHOULD_SCROLL,
    shouldScroll
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

export function listenToMercuryActivity(conversationId, spark) {
  return (dispatch) => {
    dispatch(updateMercuryState({isListening: true}));
    spark.mercury.on(`event:conversation.activity`, (event) => {
      const activity = event.data.activity;
      if (activity.object.objectType === `comment` && activity.target.id === conversationId) {
        dispatch(receiveMercuryActivity(activity));
      }
    });
  };
}

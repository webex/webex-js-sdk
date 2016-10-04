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
      activitiesLimit: 10
    })
      .then((conversation) => dispatch(receiveConversation(conversation)));
  };
}

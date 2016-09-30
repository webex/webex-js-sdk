export const CREATE_CONVERSATION = `CREATE_CONVERSATION`;
export function createConversation(userId) {
  return {
    type: CREATE_CONVERSATION,
    userId
  };
}

export const RECEIVE_CONVERSATION = `RECEIVE_CONVERSATION`;
export function receiveConversation(userId, conversation) {
  return {
    type: RECEIVE_CONVERSATION,
    userId,
    conversation
  };
}

export function createConversationWithUser(userId, spark) {
  return (dispatch) => {
    dispatch(createConversation(userId));
    const params = {
      participants: [userId]
    };
    spark.conversation.create(params)
      .then((conversation) => dispatch(receiveConversation(userId, conversation)));
  };
}

export const UPDATE_MESSAGE_STATE = `UPDATE_MESSAGE_STATE`;
export function updateMessageState(state) {
  return {
    type: UPDATE_MESSAGE_STATE,
    state
  };
}

export const UPDATE_MESSAGE_CONTENT = `UPDATE_MESSAGE_CONTENT`;
export function updateMessageContent(value) {
  return {
    type: UPDATE_MESSAGE_CONTENT,
    value
  };
}

export function setMessage(value) {
  return (dispatch) => {
    dispatch(updateMessageContent(value));
  };
}

export function submitMessage(conversation, message, spark) {
  return (dispatch) => {
    dispatch(updateMessageState({isSending: true}));
    spark.conversation.post(conversation, message)
      .then(() => dispatch(updateMessageContent(``)))
      .then(() => dispatch(updateMessageState({isSending: false})));
  };
}

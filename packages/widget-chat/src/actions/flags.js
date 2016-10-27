export const BEGIN_RECEIVE_FLAGS = `BEGIN_RECEIVE_FLAGS`;
export function beginReceiveFlags() {
  return {
    type: BEGIN_RECEIVE_FLAGS
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

export const RECEIVE_FLAGS = `RECEIVE_FLAGS`;
export function receiveFlags(flags) {
  return {
    type: RECEIVE_FLAGS,
    flags
  };
}

export function fetchFlagsForConversation(conversation, spark) {
  return (dispatch) => {
    dispatch(beginReceiveFlags());
    spark.flag.list()
      .then((flags) => {
        dispatch(receiveFlags(flags));
      });
  };
}

export function flagActivity(conversation, activity, spark) {
  return (dispatch) =>
    spark.flag.create(activity)
      .then(() => {
        dispatch(flagActivityInConversation(conversation, activity));
      });
}

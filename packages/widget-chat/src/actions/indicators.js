export const ADD_TYPING_INDICATOR = `ADD_TYPING_INDICATOR`;
export function addTyping(userId) {
  return {
    type: ADD_TYPING_INDICATOR,
    payload: {
      userId
    }
  };
}

export const DELETE_TYPING_INDICATOR = `DELETE_TYPING_INDICATOR`;
export function deleteTyping(userId) {
  return {
    type: DELETE_TYPING_INDICATOR,
    payload: {
      userId
    }
  };
}

export function setTyping(userId, value) {
  return (dispatch) => {
    if (value) {
      dispatch(addTyping(userId));
    }
    else {
      dispatch(deleteTyping(userId));
    }
  };
}

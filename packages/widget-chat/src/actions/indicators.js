export const ADD_TYPING_INDICATOR = `ADD_TYPING_INDICATOR`;
export function addTyping(id) {
  return {
    type: ADD_TYPING_INDICATOR,
    id
  };
}

export const DELETE_TYPING_INDICATOR = `DELETE_TYPING_INDICATOR`;
export function deleteTyping(id) {
  return {
    type: DELETE_TYPING_INDICATOR,
    id
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

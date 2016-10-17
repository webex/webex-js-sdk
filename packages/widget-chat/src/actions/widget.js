export const UPDATE_WIDGET_STATE = `UPDATE_WIDGET_STATE`;
export function updateWidgetState(state) {
  return {
    type: UPDATE_WIDGET_STATE,
    state
  };
}

export function showScrollToBottomButton(isVisible) {
  return (dispatch) => {
    dispatch(updateWidgetState({
      showScrollToBottomButton: isVisible
    }));
  };
}

export function updateHasNewMessage(hasNew) {
  return (dispatch) => {
    dispatch(updateWidgetState({
      hasNewMessage: hasNew
    }));
  };
}

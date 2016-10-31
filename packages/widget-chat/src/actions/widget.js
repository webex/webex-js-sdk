import {deleteActivity} from './conversation';

export const UPDATE_WIDGET_STATE = `UPDATE_WIDGET_STATE`;
export function updateWidgetState(state) {
  return {
    type: UPDATE_WIDGET_STATE,
    state
  };
}

export const SET_SCROLL_POSITION = `SET_SCROLL_POSITION`;
export function setScrollPosition(scrollPosition) {
  return {
    type: SET_SCROLL_POSITION,
    scrollPosition
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

export function confirmDeleteActivity(activityId) {
  return (dispatch) => {
    dispatch(updateWidgetState({
      deletingActivityId: activityId,
      showAlertModal: true
    }));
  };
}

export function deleteActivityAndDismiss(conversation, activity, spark) {
  return (dispatch) => {
    dispatch(deleteActivity(conversation, activity, spark))
      .then(() => {
        dispatch(hideDeleteModal());
      });
  };
}

export function hideDeleteModal() {
  return (dispatch) => {
    dispatch(updateWidgetState({
      deletingActivityId: null,
      showAlertModal: false
    }));
  };
}

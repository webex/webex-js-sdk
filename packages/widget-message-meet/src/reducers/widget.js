import {
  UPDATE_WIDGET_STATE,
  SET_SCROLL_POSITION
} from '../actions/widget';

export const initialState = {
  deletingActivityId: null,
  showAlertModal: false,
  showScrollToBottomButton: false,
  hasNewMessage: false,
  hasTextAreaFocus: false
};

export default function reduceWidget(state = initialState, action) {
  switch (action.type) {
  case UPDATE_WIDGET_STATE:
    return Object.assign({}, state, action.payload.state);

  case SET_SCROLL_POSITION:
    return Object.assign({}, state, action.payload.scrollPosition);

  default:
    return state;
  }
}

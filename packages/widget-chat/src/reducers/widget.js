import {
  UPDATE_WIDGET_STATE,
  SET_SCROLL_POSITION
} from '../actions/widget';

export default function reduceWidget(state = {
  deletingActivityId: null,
  showAlertModal: false,
  showScrollToBottomButton: false,
  hasNewMessage: false,
  hasTextAreaFocus: false
}, action) {
  switch (action.type) {
  case UPDATE_WIDGET_STATE:
    return Object.assign({}, state, action.payload.state);

  case SET_SCROLL_POSITION:
    return Object.assign({}, state, action.payload.scrollPosition);

  default:
    return state;
  }
}

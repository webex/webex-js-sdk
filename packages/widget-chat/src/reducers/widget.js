import {UPDATE_WIDGET_STATE} from '../actions/widget';

export default function reduceWidget(state = {
  showScrollToBottomButton: false,
  hasNewMessage: false
}, action) {
  switch (action.type) {
  case UPDATE_WIDGET_STATE:
    return Object.assign({}, state, action.state);
  default:
    return state;
  }
}

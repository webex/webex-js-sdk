import {ADD_TYPING_INDICATOR, DELETE_TYPING_INDICATOR} from '../actions/indicators';

export default function reduceIndicators(state = {
  typing: []
}, action) {
  switch (action.type) {
  case ADD_TYPING_INDICATOR:
    if (state.typing.indexOf(action.payload.userId) === -1) {
      return {typing: [action.payload.userId, ...state.typing]};
    }
    return state;
  case DELETE_TYPING_INDICATOR:
    return {
      typing: state.typing.filter((userId) => userId !== action.payload.userId)
    };
  default:
    return state;
  }
}

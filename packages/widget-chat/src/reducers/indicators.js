import {ADD_TYPING_INDICATOR, DELETE_TYPING_INDICATOR} from '../actions/indicators';

export default function indicators(state = {
  typing: []
}, action) {
  switch (action.type) {
  case ADD_TYPING_INDICATOR:
    if (state.typing.indexOf(action.userId) === -1) {
      return {typing: [action.userId, ...state.typing]};
    }
    return state;
  case DELETE_TYPING_INDICATOR:
    return {
      typing: state.typing.filter((userId) => userId !== action.userId)
    };
  default:
    return state;
  }
}

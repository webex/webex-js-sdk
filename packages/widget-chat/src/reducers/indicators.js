import {ADD_TYPING_INDICATOR, DELETE_TYPING_INDICATOR} from '../actions/indicators';

export default function indicators(state = {
  typing: []
}, action) {
  switch (action.type) {
  case ADD_TYPING_INDICATOR:
    if (state.typing.indexOf(action.id) === -1) {
      return {typing: [action.id, ...state.typing]};
    }
    return state;
  case DELETE_TYPING_INDICATOR:
    return {
      typing: state.typing.filter((id) => id !== action.id)
    };
  default:
    return state;
  }
}

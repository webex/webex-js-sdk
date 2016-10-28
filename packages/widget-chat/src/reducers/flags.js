import {
  ADD_FLAG,
  BEGIN_RECEIVE_FLAGS,
  RECEIVE_FLAGS,
  REMOVE_FLAG
} from '../actions/flags';

function mapFlag(flag) {
  return {
    id: flag.id,
    url: flag.url,
    activityUrl: flag[`flag-item`]
  };
}

export default function conversation(state = {
  flags: [],
  hasFetched: false,
  isFetching: false
}, action) {
  switch (action.type) {

  case ADD_FLAG: {
    const flag = mapFlag(action.flag);
    return Object.assign({}, state, {
      flags: [...state.flags, flag]
    });
  }

  case BEGIN_RECEIVE_FLAGS: {
    return Object.assign({}, state, {
      isFetching: true
    });
  }

  case RECEIVE_FLAGS: {
    const flags = action.flags.map(mapFlag);
    return Object.assign({}, state, {
      hasFetched: true,
      isFetching: false,
      flags: [...flags]
    });
  }

  case REMOVE_FLAG: {
    const flags = state.flags.filter((flag) => flag.id !== action.flag.id);
    return Object.assign({}, state, {
      flags: [...flags]
    });
  }

  default: {
    return state;
  }
  }
}

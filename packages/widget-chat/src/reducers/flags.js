import {
  ADD_FLAG,
  BEGIN_RECEIVE_FLAGS,
  RECEIVE_FLAGS,
  REMOVE_FLAG,
  REMOVE_FLAG_FAIL,
  UPDATE_FLAG
} from '../actions/flags';

const IN_FLIGHT_FLAG_ID = `IN_FLIGHT_FLAG_ID`;
const IN_FLIGHT_FLAG_URL = `IN_FLIGHT_FLAG_URL`;

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
    const flag = {
      id: IN_FLIGHT_FLAG_ID,
      url: IN_FLIGHT_FLAG_URL,
      activityUrl: action.activity.url
    };
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

  case REMOVE_FLAG_FAIL: {
    const flag = action.flag;
    return Object.assign({}, state, {
      flags: [...state.flags, flag]
    });
  }

  case UPDATE_FLAG: {
    const updatedFlag = mapFlag(action.flag);
    const flags = state.flags.map((flag) => {
      if (flag.activityUrl === updatedFlag.activityUrl) {
        return updatedFlag;
      }
      return flag;
    });
    return Object.assign({}, state, {
      flags: [...flags]
    });
  }

  default: {
    return state;
  }
  }
}

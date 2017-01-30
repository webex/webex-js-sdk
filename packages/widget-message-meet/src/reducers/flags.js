import {
  ADD_FLAG,
  ADD_FLAG_BEGIN,
  REQUEST_FLAGS,
  REQUEST_FLAGS_BEGIN,
  REMOVE_FLAG
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

export const initialState = {
  flags: [],
  hasFetched: false,
  isFetching: false
};

// eslint-disable-reason Reducer Reduction Strategy incoming...
// eslint-disable-next-line complexity
export default function conversation(state = initialState, action) {
  switch (action.type) {

  case ADD_FLAG: {
    const {activity} = action.payload;
    let flags = [...state.flags];
    if (action.error) {
      // Remove in flight flag
      flags = flags.filter((flag) => flag.activityUrl !== activity.url);
    }
    else {
      const updatedFlag = mapFlag(action.payload.flag);
      flags = flags.map((flag) => {
        // Replace in flight activity flag with actual flag
        if (flag.activityUrl === updatedFlag.activityUrl) {
          return updatedFlag;
        }
        return flag;
      });
    }
    return Object.assign({}, state, {
      flags: [...flags]
    });
  }
  case ADD_FLAG_BEGIN: {
    const flag = {
      id: IN_FLIGHT_FLAG_ID,
      url: IN_FLIGHT_FLAG_URL,
      activityUrl: action.payload.activity.url
    };
    return Object.assign({}, state, {
      flags: [...state.flags, flag]
    });
  }

  case REQUEST_FLAGS_BEGIN:
    return Object.assign({}, state, {isFetching: true});
  case REQUEST_FLAGS: {
    const flagObject = Object.assign({}, state, {
      hasFetched: true,
      isFetching: false
    });
    if (action.error) {
      flagObject.error = action.payload;
    }
    else {
      const flags = action.payload.flags.map(mapFlag);
      flagObject.flags = [...flags];
    }
    return flagObject;
  }

  case REMOVE_FLAG: {
    const {flag} = action.payload;
    let flags = [...state.flags];
    if (action.error) {
      // Unable to delete flag, add it back in
      flags.push(flag);
    }
    else {
      flags = state.flags.filter((existingFlag) => existingFlag.id !== flag.id);
    }
    return Object.assign({}, state, {
      flags: [...flags]
    });
  }
  default: {
    return state;
  }
  }
}

import {
  BEGIN_RECEIVE_FLAGS,
  RECEIVE_FLAGS
} from '../actions/flags';

export default function conversation(state = {
  flags: [],
  hasFetched: false,
  isFetching: false
}, action) {
  switch (action.type) {

  case BEGIN_RECEIVE_FLAGS: {
    return Object.assign({}, state, {
      isFetching: true
    });
  }

  case RECEIVE_FLAGS: {
    const flags = action.flags.map((flag) => (
      {
        id: flag.id,
        url: flag.url,
        activityUrl: flag[`flag-item`]
      })
    );
    return Object.assign({}, state, {
      hasFetched: true,
      isFetching: false,
      flags: [...flags]
    });
  }

  default: {
    return state;
  }
  }
}

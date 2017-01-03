import {Map} from 'immutable';

import {
  STORE_SPARK_INSTANCE,
  UPDATE_SPARK_STATUS
} from './actions';

export default function reduceSpark(state = new Map({
  status: new Map({
    authenticated: false,
    authenticating: false,
    registered: false,
    registering: false,
    connected: false,
    connecting: false
  }),
  spark: null
}), action) {
  switch (action.type) {

  case UPDATE_SPARK_STATUS:
    return state.mergeDeep({
      status: action.payload.status
    });

  case STORE_SPARK_INSTANCE:
    return state.setIn([`spark`], action.payload.spark);

  default:
    return state;
  }
}

// Store for testing
import {
  combineReducers,
  createStore
} from 'redux';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {Map} from 'immutable';
import reducers from './reducers';

export function createMockStore() {
  const mockStore = configureMockStore([thunk]);
  return mockStore(new Map({
    status: new Map({
      authenticated: false,
      authenticating: false,
      registered: false,
      registering: false,
      connected: false,
      connecting: false
    }),
    spark: null
  }));
}

export const store = createStore(
  combineReducers({
    spark: reducers
  })
);

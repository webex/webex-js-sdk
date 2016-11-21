// Store for testing
import {
  applyMiddleware,
  combineReducers,
  compose,
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

const enhancers = [
  applyMiddleware(
    thunk)
];

export const store = createStore(
  combineReducers({
    spark: reducers
  }),
  compose(...enhancers)
);

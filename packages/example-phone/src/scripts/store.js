import {routerReducer} from 'react-router-redux';
import {applyMiddleware, compose, createStore, combineReducers} from 'redux';
import persistState, {mergePersistedState} from 'redux-localstorage';
import adapter from 'redux-localstorage/lib/adapters/localStorage';
import filter from 'redux-localstorage-filter';

import {sparkReducer} from './modules/redux-spark';

import createLogger from 'redux-logger';
import thunk from 'redux-thunk';

import * as reducers from './reducers';

const reducer = compose(
  mergePersistedState()
)(combineReducers({
  ...reducers,
  spark: sparkReducer,
  routing: routerReducer
}));

const storage = compose(
  filter([
    `spark.device`,
    `spark.credentials`
  ])
)(adapter(window.localStorage));

const enhancers = [
  applyMiddleware(
    thunk,
    createLogger({
      level: `info`,
      duration: true,
      collapsed: false,
      logErrors: process.env.NODE_ENV === `production`
    })
  ),
  persistState(storage, [`example-phone`])
];

if (process.env.NODE_ENV !== `production`) {
  enhancers.push(window.devToolsExtension ? window.devToolsExtension() : (f) => f);
}

export default createStore(
  reducer,
  Reflect.apply(compose, null, enhancers)
);

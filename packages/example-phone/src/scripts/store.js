import {routerReducer} from 'react-router-redux';
import {applyMiddleware, compose, createStore, combineReducers} from 'redux';

import {sparkReducer} from './modules/redux-spark';

import createLogger from 'redux-logger';
import thunk from 'redux-thunk';

import * as reducers from './reducers';

const reducer = combineReducers({
  ...reducers,
  spark: sparkReducer,
  routing: routerReducer
});

const enhancers = [
  applyMiddleware(
    thunk,
    createLogger({
      level: `info`,
      duration: true,
      collapsed: false,
      logErrors: process.env.NODE_ENV === `production`
    })
  )
];

if (process.env.NODE_ENV !== `production`) {
  enhancers.push(window.devToolsExtension ? window.devToolsExtension() : (f) => f);
}

export default createStore(
  reducer,
  Reflect.apply(compose, null, enhancers)
);

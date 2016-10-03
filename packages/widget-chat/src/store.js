import {applyMiddleware, combineReducers, compose, createStore} from 'redux';

import thunk from 'redux-thunk';
import createLogger from 'redux-logger';
import {user, conversation} from './reducers';
import sparkReducer from './modules/redux-spark/reducers';

const devtools = window.devToolsExtension || (() => (noop) => noop);

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
  devtools()
];

export default createStore(
  combineReducers({
    user,
    conversation,
    spark: sparkReducer
  }),
  compose(...enhancers)
);

import {
  applyMiddleware,
  combineReducers,
  compose,
  createStore
} from 'redux';

import thunk from 'redux-thunk';

import {
  activity,
  conversation,
  flags,
  indicators,
  notifications,
  share,
  user,
  widget
} from './reducers';
import sparkReducer from './modules/redux-spark/reducers';

const devtools = window.devToolsExtension || (() => (noop) => noop);

const middlewares = [thunk];

if (process.env.NODE_ENV !== `production`) {
  const createLogger = require(`redux-logger`); // eslint-disable-line global-require
  const logger = createLogger({
    level: process.env.NODE_ENV === `production` ? `error` : `info`,
    duration: true,
    collapsed: false,
    logErrors: process.env.NODE_ENV === `production`
  });
  middlewares.push(logger);
}

const enhancers = [
  applyMiddleware(...middlewares),
  devtools()
];

export default createStore(
  combineReducers({
    activity,
    conversation,
    flags,
    indicators,
    notifications,
    share,
    user,
    widget,
    spark: sparkReducer
  }),
  compose(...enhancers)
);

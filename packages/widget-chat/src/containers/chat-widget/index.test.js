import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {applyMiddleware, combineReducers, compose, createStore} from 'redux';
import thunk from 'redux-thunk';

import {user, conversation, message} from '../../reducers';
import sparkReducer from '../../modules/redux-spark/reducers';
import {ChatWidget} from '.';

describe(`ChatWidget`, () => {
  const store = createStore(
    combineReducers({
      user,
      conversation,
      message,
      spark: sparkReducer
    }),
    compose(applyMiddleware(thunk))
  );

  it(`is rendered properly`, () => {
    const widget = renderer.create(
      <Provider store={store}>
        <ChatWidget />
      </Provider>
    ).toJSON;

    expect(widget).toMatchSnapshot();
  });
});

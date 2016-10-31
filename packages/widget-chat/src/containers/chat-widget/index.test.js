import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {applyMiddleware, combineReducers, compose, createStore} from 'redux';
import thunk from 'redux-thunk';

import {user, conversation, message, flags} from '../../reducers';
import sparkReducer from '../../modules/redux-spark/reducers';
import {ChatWidget} from '.';

describe(`ChatWidget`, () => {
  const store = createStore(
    combineReducers({
      user,
      conversation,
      message,
      flags,
      spark: sparkReducer
    }),
    compose(applyMiddleware(thunk))
  );

  it(`renders properly`, () => {
    const accessToken = process.env.CISCOSPARK_ACCESS_TOKEN;
    const widget = renderer.create(
      <Provider store={store}>
        <ChatWidget accessToken={accessToken} userId="bernie.zang@gmail.com" />
      </Provider>
    ).toJSON();

    expect(widget).toMatchSnapshot();
  });
});

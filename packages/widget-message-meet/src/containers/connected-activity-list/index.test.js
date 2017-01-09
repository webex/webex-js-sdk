import React from 'react';
import {Provider} from 'react-redux';
import renderer from 'react-test-renderer';
import configureStore from 'redux-mock-store';

import {initialState as conversation} from '../../reducers/conversation';
import {initialState as flags} from '../../reducers/flags';
import {initialState as user} from '../../reducers/user';

import ConnectedActivityList from '.';

const middlewares = [];
const mockStore = configureStore(middlewares);

const store = mockStore({
  conversation,
  flags,
  user
});

describe(`ConnectedActivityList`, () => {
  it(`renders properly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <ConnectedActivityList />
      </Provider>
    );

    const widget = component.toJSON();

    expect(widget).toMatchSnapshot();
  });
});

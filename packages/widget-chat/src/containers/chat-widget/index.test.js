import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';

import {store as sparkStore} from '../../modules/redux-spark/test-store';
import store from '../../store';
import ChatWidget from '.';

store.spark = sparkStore;

describe(`ChatWidget`, () => {
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

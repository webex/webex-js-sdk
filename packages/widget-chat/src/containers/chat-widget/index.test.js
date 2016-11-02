import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';

import store from '../../store';
import ChatWidget from '.';

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

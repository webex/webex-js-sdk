import React from 'react';
import {Provider} from 'react-redux';

import createComponentWithIntl from '../../utils/createComponentWithIntl';

import {store as sparkStore} from '../../modules/redux-spark/test-store';
import store from '../../store';
import ChatWidget from '.';

store.spark = sparkStore;

describe(`ChatWidget`, () => {
  it(`renders properly`, () => {
    const accessToken = process.env.CISCOSPARK_ACCESS_TOKEN;
    const component = createComponentWithIntl(
      <Provider store={store}>
        <ChatWidget accessToken={accessToken} userId="bernie.zang@gmail.com" />
      </Provider>
    );

    const widget = component.toJSON();

    expect(widget).toMatchSnapshot();
  });
});

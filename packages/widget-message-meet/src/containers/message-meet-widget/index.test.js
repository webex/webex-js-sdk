import React from 'react';
import {Provider} from 'react-redux';

import createComponentWithIntl from '../../utils/createComponentWithIntl';

import {store as sparkStore} from '../../modules/redux-spark/test-store';
import store from '../../store';
import MessageMeetWidget from '.';

store.spark = sparkStore;

describe(`MessageMeetWidget`, () => {
  it(`renders properly`, () => {
    const accessToken = process.env.CISCOSPARK_ACCESS_TOKEN;
    const component = createComponentWithIntl(
      <Provider store={store}>
        <MessageMeetWidget accessToken={accessToken} userId="sparky@ciscospark.com" />
      </Provider>
    );

    const widget = component.toJSON();

    expect(widget).toMatchSnapshot();
  });
});

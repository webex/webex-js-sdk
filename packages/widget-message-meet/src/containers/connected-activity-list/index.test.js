import React from 'react';
import {Provider} from 'react-redux';
import createComponentWithIntl from '../../utils/createComponentWithIntl';

import ConnectedActivityList from '.';

import store from '../../selectors/fixtures/mock-store';

describe(`ConnectedActivityList`, () => {
  it(`renders properly`, () => {
    const component = createComponentWithIntl(
      <Provider store={store}>
        <ConnectedActivityList />
      </Provider>
    );

    const widget = component.toJSON();

    expect(widget).toMatchSnapshot();
  });
});

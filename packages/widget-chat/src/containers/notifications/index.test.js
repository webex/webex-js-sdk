import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';

import store from '../../store';

import Notifications from '.';

describe(`Notifications container`, () => {
  it(`renders properly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <Notifications />
      </Provider>
    );
    expect(component).toMatchSnapshot();
  });
});

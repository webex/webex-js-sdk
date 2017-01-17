import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';

import store from '../../store';

import ReadReceipts from '.';

describe(`ReadReceipts container`, () => {
  it(`renders properly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <ReadReceipts />
      </Provider>
    );
    expect(component).toMatchSnapshot();
  });
});

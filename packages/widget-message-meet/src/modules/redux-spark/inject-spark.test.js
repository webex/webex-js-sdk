import React from 'react';
import {Provider} from 'react-redux';
import renderer from 'react-test-renderer';
import {store} from './test-store';

import TestComponent from '../../../test/test-component';

describe(`injectSpark`, () => {

  it(`renders correctly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <TestComponent />
      </Provider>
    ).toJSON();

    expect(component).toMatchSnapshot();
  });
});

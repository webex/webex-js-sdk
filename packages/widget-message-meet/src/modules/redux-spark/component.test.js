import React from 'react';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {store} from './test-store';

import SparkComponent from './component';


describe(`spark component`, () => {

  it(`renders correctly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <SparkComponent accessToken={`abc123`} />
      </Provider>
    ).toJSON();

    expect(component).toMatchSnapshot();
  });
});

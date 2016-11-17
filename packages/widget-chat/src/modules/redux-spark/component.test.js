import React from 'react';
import configureMockStore from 'redux-mock-store';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {Map} from 'immutable';

import SparkComponent from './component';

const mockStore = configureMockStore([]);

function createStore() {
  return mockStore(new Map({
    spark: new Map({
      authenticated: false,
      authenticating: false,
      registered: false,
      registering: false,
      connected: false,
      connecting: false
    })
  }));
}

describe(`spark component`, () => {
  const store = createStore();

  it(`renders correctly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <SparkComponent />
      </Provider>
    ).toJSON();

    expect(component).toMatchSnapshot();
  });
});

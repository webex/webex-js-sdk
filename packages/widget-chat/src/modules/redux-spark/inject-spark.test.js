import React from 'react';
import {Provider} from 'react-redux';
import configureMockStore from 'redux-mock-store';
import renderer from 'react-test-renderer';


import TestComponent from '../../../test/test-component';

const mockStore = configureMockStore([]);

function createStore() {
  return mockStore({
    spark: {
      authenticated: false,
      authenticating: false,
      registered: false,
      registering: false,
      connected: false,
      connecting: false
    }
  });
}

describe(`injectSpark`, () => {
  const store = createStore();

  it(`renders correctly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <TestComponent />
      </Provider>
    ).toJSON();

    expect(component).toMatchSnapshot();
  });
});

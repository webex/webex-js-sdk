import React from 'react';
import configureMockStore from 'redux-mock-store';
import renderer from 'react-test-renderer';
import {Provider} from 'react-redux';

import SparkComponent from './component';
import createSpark from './spark';

const mockStore = configureMockStore([]);

function createStore() {
  return mockStore({
    authenticated: false,
    authenticating: false,
    registered: false,
    registering: false,
    connected: false,
    connecting: false
  });
}

describe(`spark component`, () => {
  const spark = createSpark();
  const store = createStore();

  it(`renders correctly`, () => {
    const component = renderer.create(
      <Provider store={store}>
        <SparkComponent spark={spark} />
      </Provider>
    ).toJSON();

    expect(component).toMatchSnapshot();
  });
});

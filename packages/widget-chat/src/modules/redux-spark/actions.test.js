/* eslint max-nested-callbacks: ["error", 3] */

import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import {createSpark} from './spark';
import {
  UPDATE_SPARK_STATE,
  updateSparkState,
  registerDevice,
  connectToMercury
} from './actions';

const mockStore = configureMockStore([thunk]);

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

describe(`actions`, () => {
  it(`should create an action to update spark state`, () => {
    const newState = {
      registered: true,
      authenticated: true,
      connected: true
    };

    const expectedAction = {
      type: UPDATE_SPARK_STATE,
      state: newState
    };

    expect(updateSparkState(newState)).toEqual(expectedAction);
  });
});

describe(`sdk actions`, () => {

  it(`should register this device with spark`, () => {
    const spark = createSpark();
    const store = createStore();
    const expectedActions = [{
      type: UPDATE_SPARK_STATE,
      state: {registering: true}
    }, {
      type: UPDATE_SPARK_STATE,
      state: {registering: false, registered: true}
    }];

    return store.dispatch(registerDevice(spark))
      .then(() => {
        expect(store.getActions()).toEqual(expectedActions);
      });
  });

  it(`should connect to mercury with spark`, () => {
    const spark = createSpark();
    const store = createStore();
    const expectedActions = [{
      type: UPDATE_SPARK_STATE,
      state: {connecting: true}
    }, {
      type: UPDATE_SPARK_STATE,
      state: {connecting: false, connected: true}
    }];

    return store.dispatch(connectToMercury(spark))
      .then(() => {
        expect(store.getActions()).toEqual(expectedActions);
      });
  });
});

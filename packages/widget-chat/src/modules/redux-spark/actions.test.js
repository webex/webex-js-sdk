/* eslint max-nested-callbacks: ["error", 3] */

import {createSpark} from './spark';
import {store} from './test-store';
import {
  UPDATE_SPARK_STATE,
  updateSparkState,
  registerDevice,
  connectToMercury
} from './actions';

const ACCESS_TOKEN = process.env.CISCOSPARK_ACCESS_TOKEN;


describe(`actions`, () => {
  it(`should create an action to update spark status`, () => {
    const newState = {
      registered: true,
      authenticated: true,
      connected: true
    };

    const expectedAction = {
      type: UPDATE_SPARK_STATE,
      payload: {
        status: newState
      }
    };

    expect(updateSparkState(newState)).toEqual(expectedAction);
  });
});

describe(`sdk actions`, () => {

  it(`should register this device with spark`, () => {
    const spark = createSpark(ACCESS_TOKEN);
    const expectedActions = [{
      type: UPDATE_SPARK_STATE,
      payload: {
        status: {registering: true}
      }
    }, {
      type: UPDATE_SPARK_STATE,
      payload: {
        status: {registering: false, registered: true}
      }
    }];

    return store.dispatch(registerDevice(spark))
      .then(() => {
        expect(store.getActions()).toEqual(expectedActions);
      });
  });

  it(`should connect to mercury with spark`, () => {
    const spark = createSpark(ACCESS_TOKEN);
    const expectedActions = [{
      type: UPDATE_SPARK_STATE,
      payload: {
        status: {connecting: true}
      }
    }, {
      type: UPDATE_SPARK_STATE,
      payload: {
        status: {connecting: false, connected: true}
      }
    }];

    return store.dispatch(connectToMercury(spark))
      .then(() => {
        expect(store.getActions()).toEqual(expectedActions);
      });
  });
});

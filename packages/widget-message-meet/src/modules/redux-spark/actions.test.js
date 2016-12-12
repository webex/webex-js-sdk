/* eslint max-nested-callbacks: ["error", 3] */
jest.mock(`./spark`);
const {createSpark} = require(`./spark`);

import {createMockStore} from './test-store';
import {
  UPDATE_SPARK_STATUS,
  updateSparkStatus,
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
      type: UPDATE_SPARK_STATUS,
      payload: {
        status: newState
      }
    };

    expect(updateSparkStatus(newState)).toEqual(expectedAction);
  });
});

describe(`sdk actions`, () => {
  let mockStore;

  beforeEach(() => {
    mockStore = createMockStore();
  });

  it(`should register this device with spark`, () => {
    const spark = createSpark(ACCESS_TOKEN);
    const expectedActions = [{
      type: UPDATE_SPARK_STATUS,
      payload: {
        status: {registering: true}
      }
    }, {
      type: UPDATE_SPARK_STATUS,
      payload: {
        status: {registering: false, registered: true}
      }
    }];

    return mockStore.dispatch(registerDevice(spark))
      .then(() => {
        expect(mockStore.getActions()).toEqual(expectedActions);
      });
  });

  it(`should connect to mercury with spark`, () => {
    const spark = createSpark(ACCESS_TOKEN);
    const expectedActions = [{
      type: UPDATE_SPARK_STATUS,
      payload: {
        status: {connecting: true}
      }
    }, {
      type: UPDATE_SPARK_STATUS,
      payload: {
        status: {connecting: false, connected: true}
      }
    }];

    return mockStore.dispatch(connectToMercury(spark))
      .then(() => {
        expect(mockStore.getActions()).toEqual(expectedActions);
      });
  });
});

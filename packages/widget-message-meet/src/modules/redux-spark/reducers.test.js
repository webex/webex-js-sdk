import {Map} from 'immutable';
import reducer from './reducers';

describe(`spark reducer`, () => {
  const initialState = new Map({
    status: new Map({
      authenticated: false,
      authenticating: false,
      registered: false,
      registering: false,
      connected: false,
      connecting: false
    }),
    spark: null
  });

  it(`should return initial state`, () => {
    expect(reducer(undefined, {}))
      .toEqual(initialState);
  });

  it(`should handle UPDATE_SPARK_STATUS`, () => {
    expect(reducer(initialState, {
      type: `UPDATE_SPARK_STATUS`,
      payload: {
        status: {
          authenticated: true,
          registered: true,
          connected: true
        }
      }
    }).toJS())
    .toEqual({
      status: {
        authenticated: true,
        authenticating: false,
        registered: true,
        registering: false,
        connected: true,
        connecting: false
      },
      spark: null
    });
  });
});

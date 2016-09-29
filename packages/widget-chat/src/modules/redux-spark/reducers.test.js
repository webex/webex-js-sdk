import reducer from './reducers';

describe(`spark reducer`, () => {
  const initialState = {
    authenticated: false,
    authenticating: false,
    registered: false,
    registering: false,
    connected: false,
    connecting: false
  };

  it(`should return initial state`, () => {
    expect(reducer(undefined, {}))
      .toEqual(initialState);
  });

  it(`should handle UPDATE_SPARK_STATE`, () => {
    expect(reducer(initialState, {
      type: `UPDATE_SPARK_STATE`,
      state: {
        authenticated: true,
        registered: true,
        connected: true
      }
    }))
    .toEqual({
      authenticated: true,
      authenticating: false,
      registered: true,
      registering: false,
      connected: true,
      connecting: false
    });
  });
});

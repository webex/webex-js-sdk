export const UPDATE_SPARK_STATE = `UPDATE_SPARK_STATE`;
export function updateSparkState(state) {
  return {
    type: UPDATE_SPARK_STATE,
    state
  };
}

export function registerDevice(spark) {
  return (dispatch) => {
    spark.device.register()
      .then(dispatch(updateSparkState({
        authenticated: true, authenticating: false
      })));
  };
}

export function connectToMercury(spark) {
  return (dispatch) => {
    spark.mercury.connect()
      .then(dispatch(updateSparkState({connected: true, connecting: false})));
    dispatch(updateSparkState({connecting: true}));
  };
}

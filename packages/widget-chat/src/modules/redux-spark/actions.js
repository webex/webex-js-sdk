export const UPDATE_SPARK_STATE = `UPDATE_SPARK_STATE`;
export function updateSparkState(state) {
  return {
    type: UPDATE_SPARK_STATE,
    state
  };
}

export function registerDevice(spark) {
  return (dispatch) => {
    dispatch(updateSparkState({registering: true}));
    return spark.device.register()
      .then(() => dispatch(updateSparkState({registering: false, registered: true})));
  };
}

export function connectToMercury(spark) {
  return (dispatch) => {
    dispatch(updateSparkState({connecting: true}));
    return spark.mercury.connect()
    .then(() => dispatch(updateSparkState({connecting: false, connected: true})));
  };
}

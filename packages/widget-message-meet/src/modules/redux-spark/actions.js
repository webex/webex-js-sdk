export const UPDATE_SPARK_STATUS = `UPDATE_SPARK_STATUS`;
export function updateSparkStatus(status) {
  return {
    type: UPDATE_SPARK_STATUS,
    payload: {
      status
    }
  };
}

export const STORE_SPARK_INSTANCE = `STORE_SPARK_INSTANCE`;
export function storeSparkInstance(spark) {
  return {
    type: STORE_SPARK_INSTANCE,
    payload: {
      spark
    }
  };
}


export function registerDevice(spark) {
  return (dispatch) => {
    dispatch(updateSparkStatus({registering: true}));
    return spark.device.register()
      .then(() => dispatch(updateSparkStatus({registering: false, registered: true})));
  };
}

export function connectToMercury(spark) {
  return (dispatch) => {
    dispatch(updateSparkStatus({connecting: true}));
    return spark.mercury.connect()
    .then(() => dispatch(updateSparkStatus({connecting: false, connected: true})));
  };
}

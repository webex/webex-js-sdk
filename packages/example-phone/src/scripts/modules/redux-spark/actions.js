import {createAction} from 'redux-actions';

const REDUX_SPARK_REDIRECT = `REDUX_SPARK_REDIRECT`;
const redirect = createAction(REDUX_SPARK_REDIRECT);

export function loginWithUI(spark) {
  return (dispatch) => {
    spark.authorize();
    dispatch(redirect());
  };
}

export const REDUX_SPARK_STATE_UPDATE = `REDUX_SPARK_STATE_UPDATE`;
export const updateState = createAction(REDUX_SPARK_STATE_UPDATE);

export function connectToMercury(spark) {
  return (dispatch) => {
    spark.phone.register();
    dispatch(updateState({connecting: true}));
  };
}

export const REDUX_SPARK_RECEIVE_CREDENTIALS = `REDUX_SPARK_RECEIVE_CREDENTIALS`;
export const receiveCredentials = createAction(REDUX_SPARK_RECEIVE_CREDENTIALS, (spark) => spark.credentials.serialize());

export const REDUX_SPARK_RECEIVE_DEVICE = `REDUX_SPARK_RECEIVE_DEVICE`;
export const receiveDevice = createAction(REDUX_SPARK_RECEIVE_DEVICE, (spark) => spark.device.serialize());

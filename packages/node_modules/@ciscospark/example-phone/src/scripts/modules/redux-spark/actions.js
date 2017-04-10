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

import {defaults} from 'lodash';
import {createAction} from 'redux-actions';
import {
  bindCallActions,
  callDisconnected
} from './call';
import {allowLocalMedia} from './self-view';

export const ANSWER_CALL = `ANSWER_CALL`;
export const DECLINE_CALL = `DECLINE_CALL`;
export const RING = `RING`;

export function answer(spark, call, constraints) {
  return (dispatch) => {
    constraints = defaults(constraints, {
      fake: process.env.NODE_ENV === `test`
    });

    // TODO answer should receive a stream in position 3
    // TODO Call should get its own media stream if one is not passed to it
    spark.phone.createLocalMediaStream({constraints})
      .then((stream) => {
        dispatch(allowLocalMedia(stream));
        bindCallActions(dispatch, call);
        call.answer(Object.assign({constraints}, {localMediaStream: stream}));
      });
  };
}

export const decline = createAction(DECLINE_CALL, (call) => {
  call.reject();
  return call;
});

const _ring = createAction(RING);

export function ring(call) {
  return (dispatch) => {
    call.on(`disconnected`, () => dispatch(callDisconnected(call)));
    dispatch(_ring(call));
  };
}

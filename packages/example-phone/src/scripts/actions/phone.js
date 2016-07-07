import {createAction} from 'redux-actions';
import {allowLocalMedia} from './self-view';
import {
  bindCallActions,
  callDisconnected
} from './call';

export function dial(spark, invitee) {
  return (dispatch) => {
    // TODO Call should get its own media stream if one is not passed to it
    spark.phone.createLocalMediaStream({
      audio: true,
      video: true,
      fake: process.env.NODE_ENV === `test`
    })
      .then((localMediaStream) => {
        dispatch(allowLocalMedia(localMediaStream));

        const call = spark.phone.dial(invitee, {localMediaStream});
        // TODO need to dispatch local call immediately so that it can be ended
        // if need be
        call.on(`disconnected`, () => dispatch(callDisconnected(call)));
        bindCallActions(dispatch, call);
      });
  };
}

export const RECEIVE_CALL_HISTORY = `RECEIVE_CALL_HISTORY`;
export const receiveCallHistory = createAction(RECEIVE_CALL_HISTORY);

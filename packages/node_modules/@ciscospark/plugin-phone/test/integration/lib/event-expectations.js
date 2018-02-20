import {expectEvent} from '@ciscospark/test-helper-mocha';
import {phoneEvents} from '@ciscospark/plugin-phone';

export function expectCallCreatedEvent(ctx, msg) {
  return expectEvent(20000, phoneEvents.CALL_CREATED, ctx, msg);
}

export function expectCallIncomingEvent(ctx, msg) {
  return expectEvent(20000, phoneEvents.CALL_INCOMING, ctx, msg);
}

export function expectChangeActiveParticipantsCountEvent(ctx, msg) {
  return expectEvent(20000, 'change:activeParticipantsCount', ctx, msg);
}

export function expectChangeLocusEvent(ctx, msg) {
  return expectEvent(20000, 'change:locus', ctx, msg);
}

export function expectChangeStateEvent(ctx, msg) {
  return expectEvent(20000, 'change:state', ctx, msg);
}

export function expectDeclinedEvent(ctx, msg) {
  return expectEvent(20000, 'declined', ctx, msg);
}

export function expectConnectedEvent(ctx, msg) {
  return expectEvent(20000, 'connected', ctx, msg);
}

export function expectDisconnectedEvent(ctx, msg) {
  return expectEvent(20000, 'disconnected', ctx, msg);
}

export function expectErrorEvent(ctx, msg) {
  return expectEvent(20000, 'error', ctx, msg);
}

export function expectInactiveEvent(ctx, msg) {
  return expectEvent(20000, 'inactive', ctx, msg);
}

/**
 * This function wraps a expectMembership* function, and calls it recursively
 * until the changed member
 *
 * This is a reimplementation of expectEvent specific to `membership:*` events
 * which only resolves when the event fires *for the expected membership*
 *
 * @param {string} event
 * @param {EventEmitter} emitter
 * @param {string} id
 * @param {string} [msg]
 * @returns {Promise}
 */
export function expectMembershipEvent(event, emitter, id, msg) {
  const max = 20000;
  if (!id) {
    return expectEvent(max, event, emitter, msg);
  }
  let timer;
  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${event} did not fire within ${max}ms${msg ? `: ${msg}` : ''}`));
      }, max);
    }),
    new Promise((resolve) => {
      emitter.once(event, onEvent);

      function onEvent(result) {
        if (result.personUuid === id) {
          clearTimeout(timer);
          resolve(result);
          return;
        }

        emitter.once(event, onEvent);
      }
    })
  ]);
}

export function expectMembershipChangeEvent(ctx, id, msg) {
  return expectMembershipEvent('membership:change', ctx, id, msg);
}

export function expectMembershipConnectedEvent(ctx, id, msg) {
  return expectMembershipEvent('membership:connected', ctx, id, msg);
}

export function expectMembershipDeclinedEvent(ctx, id, msg) {
  return expectMembershipEvent('membership:declined', ctx, id, msg);
}

export function expectMembershipDisconnectedEvent(ctx, id, msg) {
  return expectMembershipEvent('membership:disconnected', ctx, id, msg);
}

export function expectRemoteAudioMutedChangeEvent(ctx, msg) {
  return expectEvent(20000, 'remoteAudioMuted:change', ctx, msg);
}

export function expectRemoteVideoMutedChangeEvent(ctx, msg) {
  return expectEvent(20000, 'remoteVideoMuted:change', ctx, msg);
}

export function expectRingingEvent(ctx, msg) {
  return expectEvent(20000, 'ringing', ctx, msg);
}

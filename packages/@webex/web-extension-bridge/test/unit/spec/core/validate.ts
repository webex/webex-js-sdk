import {assert} from '@webex/test-helper-chai';

import {
  CLOCK_SKEW_TOLERANCE_MS,
  DEFAULT_MAX_PAYLOAD_BYTES,
  ENVELOPE_MARKER,
  MAX_ID_LENGTH,
  PROTOCOL_VERSION,
  RESERVED_KEYS,
} from '../../../../src/core/constants';
import {EnvelopeKind, EnvelopeSource} from '../../../../src/core/protocol';
import {SeenIds} from '../../../../src/core/replay';
import {DropReason, validateEnvelope} from '../../../../src/core/validate';
import type {ValidateContext} from '../../../../src/core/validate';

const NOW = 1700000000000;
const SESSION = 'the-session-token';

function context(overrides: Partial<ValidateContext> = {}): ValidateContext {
  return {
    channel: 'webex-bridge',
    expectedSource: EnvelopeSource.PAGE,
    session: SESSION,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD_BYTES,
    now: NOW,
    ...overrides,
  };
}

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [ENVELOPE_MARKER]: true,
    v: PROTOCOL_VERSION,
    channel: 'webex-bridge',
    kind: EnvelopeKind.PUSH,
    source: EnvelopeSource.PAGE,
    topic: 'demo.topic',
    id: 'an-id',
    correlationId: null,
    session: SESSION,
    ts: NOW,
    ...overrides,
  };
}

describe('core/validate', () => {
  it('accepts a well-formed envelope', () => {
    const result = validateEnvelope(envelope(), context());

    assert.isTrue(result.ok);
  });

  describe('rejections', () => {
    const cases: {reason: string; name: string; value: unknown; ctx?: Partial<ValidateContext>}[] = [
      {reason: DropReason.NOT_AN_ENVELOPE, name: 'a string', value: 'hello'},
      {reason: DropReason.NOT_AN_ENVELOPE, name: 'null', value: null},
      {reason: DropReason.NOT_AN_ENVELOPE, name: 'an array', value: [envelope()]},
      {
        reason: DropReason.NOT_AN_ENVELOPE,
        name: 'a missing marker',
        value: {...envelope(), [ENVELOPE_MARKER]: undefined},
      },
      {
        reason: DropReason.NOT_AN_ENVELOPE,
        name: 'an inherited marker',
        value: Object.create(envelope()),
      },
      {
        reason: DropReason.VERSION_MISMATCH,
        name: 'a newer protocol version',
        value: envelope({v: PROTOCOL_VERSION + 1}),
      },
      {
        reason: DropReason.VERSION_MISMATCH,
        name: 'a string version',
        value: envelope({v: String(PROTOCOL_VERSION)}),
      },
      {
        reason: DropReason.CHANNEL_MISMATCH,
        name: 'another channel',
        value: envelope({channel: 'other-channel'}),
      },
      {reason: DropReason.UNKNOWN_KIND, name: 'an unknown kind', value: envelope({kind: 'EVAL'})},
      {reason: DropReason.UNKNOWN_KIND, name: 'a non-string kind', value: envelope({kind: 7})},
      {
        reason: DropReason.KIND_NOT_ALLOWED,
        name: 'a kind this hop does not accept',
        value: envelope({kind: EnvelopeKind.REQUEST}),
        ctx: {allowedKinds: [EnvelopeKind.PUSH]},
      },
      {
        reason: DropReason.INVALID_SOURCE,
        name: 'our own source tag echoed back',
        value: envelope({source: EnvelopeSource.EXTENSION}),
      },
      {reason: DropReason.INVALID_ID, name: 'an empty id', value: envelope({id: ''})},
      {reason: DropReason.INVALID_ID, name: 'a non-string id', value: envelope({id: 12})},
      {
        reason: DropReason.INVALID_ID,
        name: 'an over-long id',
        value: envelope({id: 'x'.repeat(MAX_ID_LENGTH + 1)}),
      },
      {
        reason: DropReason.INVALID_CORRELATION_ID,
        name: 'an empty correlation id',
        value: envelope({correlationId: ''}),
      },
      {
        reason: DropReason.INVALID_CORRELATION_ID,
        name: 'an over-long correlation id',
        value: envelope({correlationId: 'x'.repeat(MAX_ID_LENGTH + 1)}),
      },
      {
        reason: DropReason.INVALID_CORRELATION_ID,
        name: 'a response with no correlation id',
        value: envelope({kind: EnvelopeKind.RESPONSE, ok: true, correlationId: null}),
      },
      {reason: DropReason.INVALID_TOPIC, name: 'an empty topic', value: envelope({topic: ''})},
      {
        reason: DropReason.INVALID_TOPIC,
        name: 'a topic with a slash',
        value: envelope({topic: 'a/b'}),
      },
      {
        reason: DropReason.INVALID_TOPIC,
        name: 'a topic with a space',
        value: envelope({topic: 'a b'}),
      },
      {
        reason: DropReason.INVALID_TOPIC,
        name: 'an over-long topic',
        value: envelope({topic: 'a'.repeat(129)}),
      },
      {
        reason: DropReason.SESSION_MISMATCH,
        name: 'a forged session token',
        value: envelope({session: 'not-the-session'}),
      },
      {
        reason: DropReason.SESSION_MISMATCH,
        name: 'a missing session token',
        value: envelope({session: undefined}),
      },
      {
        reason: DropReason.SESSION_MISMATCH,
        name: 'any non-HELLO kind before a session exists',
        value: envelope({session: ''}),
        ctx: {session: null},
      },
      {
        reason: DropReason.CLOCK_SKEW,
        name: 'a timestamp too far in the past',
        value: envelope({ts: NOW - CLOCK_SKEW_TOLERANCE_MS - 1}),
      },
      {
        reason: DropReason.CLOCK_SKEW,
        name: 'a timestamp too far in the future',
        value: envelope({ts: NOW + CLOCK_SKEW_TOLERANCE_MS + 1}),
      },
      {reason: DropReason.CLOCK_SKEW, name: 'a missing timestamp', value: envelope({ts: undefined})},
      {reason: DropReason.CLOCK_SKEW, name: 'a NaN timestamp', value: envelope({ts: NaN})},
      {
        reason: DropReason.PAYLOAD_TOO_LARGE,
        name: 'a payload over the cap',
        value: envelope({payload: 'x'.repeat(200)}),
        ctx: {maxPayloadBytes: 100},
      },
      {
        reason: DropReason.INVALID_RESULT,
        name: 'a response with no ok flag',
        value: envelope({kind: EnvelopeKind.RESPONSE, correlationId: 'req-1'}),
      },
      {
        reason: DropReason.INVALID_RESULT,
        name: 'a response with a non-boolean ok flag',
        value: envelope({kind: EnvelopeKind.RESPONSE, correlationId: 'req-1', ok: 'yes'}),
      },
    ];

    cases.forEach(({reason, name, value, ctx}) => {
      it(`drops ${name} as ${reason}`, () => {
        const result = validateEnvelope(value, context(ctx));

        assert.isFalse(result.ok);
        assert.equal(result.ok === false && result.reason, reason);
      });
    });

    RESERVED_KEYS.forEach((key) => {
      it(`drops an envelope with a '${key}' key as RESERVED_KEY`, () => {
        const value = envelope();

        // Plain assignment to `__proto__` sets the prototype instead of creating an
        // own key, which is not the shape a structured clone delivers.
        Object.defineProperty(value, key, {
          value: {polluted: true},
          enumerable: true,
          configurable: true,
          writable: true,
        });

        assert.deepEqual(validateEnvelope(value, context()), {
          ok: false,
          reason: DropReason.RESERVED_KEY,
        });
      });

      it(`drops a payload containing '${key}' as RESERVED_KEY`, () => {
        const value = envelope({payload: JSON.parse(`{"nested": {"${key}": 1}}`)});

        assert.deepEqual(validateEnvelope(value, context()), {
          ok: false,
          reason: DropReason.RESERVED_KEY,
        });
      });
    });
  });

  describe('HELLO exemption', () => {
    it('accepts HELLO before a session is established', () => {
      const result = validateEnvelope(
        envelope({kind: EnvelopeKind.HELLO, session: ''}),
        context({session: null})
      );

      assert.isTrue(result.ok);
    });

    it('accepts a HELLO carrying a token that differs from the current one', () => {
      const result = validateEnvelope(
        envelope({kind: EnvelopeKind.HELLO, session: 'a-new-token'}),
        context()
      );

      assert.isTrue(result.ok);
    });

    it('accepts HELLO_ACK before a session exists, since it delivers the first token', () => {
      const result = validateEnvelope(
        envelope({kind: EnvelopeKind.HELLO_ACK, session: 'a-fresh-token'}),
        context({session: null})
      );

      assert.isTrue(result.ok);
    });

    it('rejects a HELLO_ACK that tries to switch an established session', () => {
      const result = validateEnvelope(
        envelope({kind: EnvelopeKind.HELLO_ACK, session: 'a-different-token'}),
        context()
      );

      assert.isFalse(result.ok);
      assert.equal(result.ok === false && result.reason, DropReason.SESSION_MISMATCH);
    });

    it('still rejects a HELLO with an over-long token', () => {
      const result = validateEnvelope(
        envelope({kind: EnvelopeKind.HELLO, session: 'x'.repeat(MAX_ID_LENGTH + 1)}),
        context({session: null})
      );

      assert.isFalse(result.ok);
      assert.equal(result.ok === false && result.reason, DropReason.SESSION_MISMATCH);
    });
  });

  describe('replay detection', () => {
    it('accepts an id once and drops it thereafter', () => {
      const seenIds = new SeenIds({now: () => NOW});
      const ctx = context({seenIds});

      assert.isTrue(validateEnvelope(envelope({id: 'once'}), ctx).ok);

      const second = validateEnvelope(envelope({id: 'once'}), ctx);

      assert.isFalse(second.ok);
      assert.equal(second.ok === false && second.reason, DropReason.REPLAYED_ID);
    });

    it('does not spend a cache slot on an envelope that failed an earlier rule', () => {
      const seenIds = new SeenIds({now: () => NOW});

      validateEnvelope(envelope({id: 'rejected', channel: 'wrong'}), context({seenIds}));

      assert.equal(seenIds.size, 0);
      assert.isTrue(validateEnvelope(envelope({id: 'rejected'}), context({seenIds})).ok);
    });
  });
});

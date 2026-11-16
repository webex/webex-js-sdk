import {assert} from '@webex/test-helper-chai';

import {ENVELOPE_MARKER, PROTOCOL_VERSION} from '../../../../src/core/constants';
import {
  ENVELOPE_KINDS,
  EnvelopeKind,
  EnvelopeSource,
  createEnvelope,
  peerSource,
} from '../../../../src/core/protocol';

describe('core/protocol', () => {
  const input = {
    channel: 'webex-bridge',
    kind: EnvelopeKind.PUSH,
    source: EnvelopeSource.PAGE,
    topic: 'demo.topic',
    id: 'an-id',
    session: 'a-session',
  };

  it('stamps the marker and the protocol version', () => {
    const envelope = createEnvelope(input);

    assert.isTrue(envelope[ENVELOPE_MARKER]);
    assert.equal(envelope.v, PROTOCOL_VERSION);
  });

  it('builds on a null prototype so no field can reach Object.prototype', () => {
    assert.isNull(Object.getPrototypeOf(createEnvelope(input)));
  });

  it('defaults correlationId to null and ts to now', () => {
    const before = Date.now();
    const envelope = createEnvelope(input);

    assert.isNull(envelope.correlationId);
    assert.isAtLeast(envelope.ts, before);
  });

  it('omits optional fields rather than sending explicit undefined', () => {
    const keys = Object.getOwnPropertyNames(createEnvelope(input));

    assert.notInclude(keys, 'payload');
    assert.notInclude(keys, 'ok');
    assert.notInclude(keys, 'error');
  });

  it('carries a response result', () => {
    const envelope = createEnvelope({
      ...input,
      kind: EnvelopeKind.RESPONSE,
      correlationId: 'req-1',
      ok: false,
      error: {code: 'NO_HANDLER', message: 'nope'},
    });

    assert.equal(envelope.correlationId, 'req-1');
    assert.isFalse(envelope.ok);
    assert.deepEqual(envelope.error, {code: 'NO_HANDLER', message: 'nope'});
  });

  it('keeps a false or null payload, which are meaningful values', () => {
    assert.isFalse(createEnvelope({...input, payload: false}).payload);
    assert.isNull(createEnvelope({...input, payload: null}).payload);
  });

  it('survives a JSON round trip, as a structured clone would', () => {
    const envelope = createEnvelope({...input, payload: {a: [1, null, 'two']}});

    assert.deepEqual(JSON.parse(JSON.stringify(envelope)), {...envelope});
  });

  describe('peerSource', () => {
    it('pairs page with extension', () => {
      assert.equal(peerSource(EnvelopeSource.PAGE), EnvelopeSource.EXTENSION);
      assert.equal(peerSource(EnvelopeSource.EXTENSION), EnvelopeSource.PAGE);
    });
  });

  it('enumerates exactly the six protocol kinds', () => {
    assert.sameMembers([...ENVELOPE_KINDS], [
      'HELLO',
      'HELLO_ACK',
      'PUSH',
      'REQUEST',
      'RESPONSE',
      'BYE',
    ]);
  });
});

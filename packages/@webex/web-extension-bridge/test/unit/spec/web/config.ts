import {assert} from '@webex/test-helper-chai';

import {DEFAULT_CHANNEL, DEFAULT_MAX_PAYLOAD_BYTES} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import {resolveWebConfig} from '../../../../src/web/config';
import {createFakeWindow} from '../../lib/fakeWindow';

const ORIGIN = 'https://app.example.com';

describe('web/config', () => {
  const win = () => createFakeWindow(ORIGIN);

  it('defaults to the document origin and the default channel', () => {
    const config = resolveWebConfig(win());

    assert.equal(config.channel, DEFAULT_CHANNEL);
    assert.equal(config.targetOrigin, ORIGIN);
    assert.deepEqual([...config.allowedOrigins], [ORIGIN]);
    assert.equal(config.maxPayloadBytes, DEFAULT_MAX_PAYLOAD_BYTES);
    assert.isFalse(config.debug);
  });

  it('always targets the document origin, never a caller-chosen one', () => {
    const config = resolveWebConfig(win(), {
      allowedOrigins: [ORIGIN, 'https://other.example.com'],
    });

    assert.equal(config.targetOrigin, ORIGIN);
  });

  it('clamps maxPayloadBytes', () => {
    assert.equal(resolveWebConfig(win(), {maxPayloadBytes: 99999999}).maxPayloadBytes, 1048576);
  });

  describe('rejected configuration', () => {
    const cases: {name: string; options: Record<string, unknown>}[] = [
      {name: "the wildcard origin '*'", options: {allowedOrigins: ['*']}},
      {name: 'a wildcard subdomain', options: {allowedOrigins: ['https://*.example.com']}},
      {name: 'an empty origin list', options: {allowedOrigins: []}},
      {name: 'a non-array origin list', options: {allowedOrigins: ORIGIN}},
      {name: 'a non-string origin', options: {allowedOrigins: [42]}},
      {name: 'an origin with a path', options: {allowedOrigins: [`${ORIGIN}/app`]}},
      {name: 'an origin with a trailing slash', options: {allowedOrigins: [`${ORIGIN}/`]}},
      {name: 'a scheme-relative origin', options: {allowedOrigins: ['//app.example.com']}},
      {name: 'a bare hostname', options: {allowedOrigins: ['app.example.com']}},
      {name: 'a non-http scheme', options: {allowedOrigins: ['file://app.example.com']}},
      {
        name: 'a list that omits the document origin',
        options: {allowedOrigins: ['https://other.example.com']},
      },
      {name: 'a channel with a slash', options: {channel: 'a/b'}},
      {name: 'an empty channel', options: {channel: ''}},
      {name: 'a non-string channel', options: {channel: 7}},
    ];

    cases.forEach(({name, options}) => {
      it(`rejects ${name} with INSECURE_CONFIG`, () => {
        try {
          resolveWebConfig(win(), options as never);
          assert.fail('expected a throw');
        } catch (error) {
          assert.instanceOf(error, BridgeError);
          assert.equal((error as BridgeError).code, 'INSECURE_CONFIG');
        }
      });
    });

    it('explains that the document origin has to be in the list', () => {
      assert.throws(
        () => resolveWebConfig(win(), {allowedOrigins: ['https://other.example.com']}),
        /https:\/\/app\.example\.com/
      );
    });
  });

  it('accepts an http origin with a port, so local development needs no wildcard', () => {
    const local = createFakeWindow('http://localhost:8000');
    const config = resolveWebConfig(local, {allowedOrigins: ['http://localhost:8000']});

    assert.equal(config.targetOrigin, 'http://localhost:8000');
  });
});

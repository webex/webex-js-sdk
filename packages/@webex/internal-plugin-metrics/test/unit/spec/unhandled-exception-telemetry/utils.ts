import {assert} from '@webex/test-helper-chai';

import {
  createFingerprint,
  removeUrlDetails,
  removeUrlDetailsFromText,
  sanitizeResourceUrl,
  stringifyReason,
  truncate,
} from '@webex/internal-plugin-metrics/src/unhandled-exception-telemetry/utils';

const TEST_USERINFO = ['fixture-user', 'fixture-value'].join(':');

describe('Unhandled exception telemetry utilities', () => {
  describe('#truncate()', () => {
    it('truncates strings to the requested length', () => {
      assert.equal(truncate('abcdef', 3), 'abc');
      assert.equal(truncate('abc', 3), 'abc');
      assert.isUndefined(truncate(undefined, 3));
    });
  });

  describe('#removeUrlDetails()', () => {
    [
      {
        input: `https://${TEST_USERINFO}@example.test/path?secret=x#fragment`,
        expected: 'https://example.test/path',
      },
      {input: `//${TEST_USERINFO}@example.test/path#fragment`, expected: '//example.test/path'},
      {input: '/api/messages?secret=x', expected: '/api/messages'},
      {input: '', expected: undefined},
      {input: 42, expected: undefined},
    ].forEach(({input, expected}) => {
      it(`sanitizes ${JSON.stringify(input)}`, () => {
        assert.strictEqual(removeUrlDetails(input), expected);
      });
    });
  });

  describe('#sanitizeResourceUrl()', () => {
    [
      {
        input: ` https://${TEST_USERINFO}@example.test/app.js?secret=x `,
        expected: 'https://example.test/app.js',
      },
      {input: '/assets/app.js?secret=x', expected: '/assets/app.js'},
      {input: 'data:text/plain,secret', expected: undefined},
      {input: 'blob:https://example.test/id', expected: undefined},
      {input: undefined, expected: undefined},
    ].forEach(({input, expected}) => {
      it(`sanitizes ${JSON.stringify(input)}`, () => {
        assert.strictEqual(sanitizeResourceUrl(input), expected);
      });
    });

    it('caps resource URLs at 2048 characters', () => {
      assert.lengthOf(sanitizeResourceUrl(`/${'x'.repeat(3_000)}`) as string, 2_048);
    });
  });

  describe('#removeUrlDetailsFromText()', () => {
    [
      {
        input: `url=https://${TEST_USERINFO}@example.test/path?secret=x`,
        expected: 'url=https://example.test/path',
      },
      {input: 'payload=data:text/plain,secret', expected: 'payload=[redacted-url]'},
      {input: 'GET /api/messages?secret=x', expected: 'GET /api/messages'},
      {input: 'at load (../app.js#fragment:10:20)', expected: 'at load (../app.js)'},
      {input: 'retry api/messages?secret=x', expected: 'retry api/messages'},
      {input: 'at load (app.js?secret=x:10:20)', expected: 'at load (app.js)'},
      {input: 'GET api?secret=x', expected: 'GET api'},
    ].forEach(({input, expected}) => {
      it(`sanitizes ${input}`, () => {
        assert.equal(removeUrlDetailsFromText(input), expected);
      });
    });
  });

  describe('#createFingerprint()', () => {
    it('returns a stable eight-character key that changes with its input', () => {
      const fingerprint = createFingerprint('same error');

      assert.lengthOf(fingerprint, 8);
      assert.equal(createFingerprint('same error'), fingerprint);
      assert.notEqual(createFingerprint('different error'), fingerprint);
    });
  });

  describe('#stringifyReason()', () => {
    it('serializes strings and objects', () => {
      assert.equal(stringifyReason('failed'), 'failed');
      assert.equal(stringifyReason({message: 'failed'}), '{"message":"failed"}');
    });

    it('falls back safely when conversion hooks throw', () => {
      const reason = new Proxy(
        {},
        {
          get() {
            throw new Error('unreadable');
          },
        }
      );

      assert.equal(stringifyReason(reason), 'Unserializable rejection reason');
    });
  });
});

import {assert} from '@webex/test-helper-chai';

import {
  BRIDGE_ERROR_CODES,
  BridgeError,
  fromWireError,
  isBridgeError,
  toWireError,
} from '../../../../src/core/errors';

describe('core/errors', () => {
  describe('BridgeError', () => {
    it('is an Error with a stable name', () => {
      const error = new BridgeError('TIMEOUT');

      assert.instanceOf(error, Error);
      assert.instanceOf(error, BridgeError);
      assert.equal(error.name, 'BridgeError');
      assert.isTrue(isBridgeError(error));
      assert.isFalse(isBridgeError(new Error('nope')));
    });

    BRIDGE_ERROR_CODES.forEach((code) => {
      it(`carries the code and a non-empty default message for ${code}`, () => {
        const error = new BridgeError(code);

        assert.equal(error.code, code);
        assert.isString(error.message);
        assert.isAbove(error.message.length, 0);
      });
    });

    it('records the topic only when one is given', () => {
      assert.equal(new BridgeError('NO_HANDLER', undefined, 'a.topic').topic, 'a.topic');
      assert.isUndefined(new BridgeError('NO_HANDLER').topic);
    });
  });

  describe('toWireError', () => {
    BRIDGE_ERROR_CODES.forEach((code) => {
      it(`preserves the code for ${code}`, () => {
        assert.deepEqual(Object.keys(toWireError(new BridgeError(code))).sort(), [
          'code',
          'message',
        ]);
        assert.equal(toWireError(new BridgeError(code)).code, code);
      });
    });

    it('reduces an unknown throw to HANDLER_ERROR', () => {
      assert.equal(toWireError(new TypeError('boom')).code, 'HANDLER_ERROR');
      assert.equal(toWireError('a string').code, 'HANDLER_ERROR');
      assert.equal(toWireError(undefined).code, 'HANDLER_ERROR');
    });

    it('never leaks the original message or a stack', () => {
      const secret = 'user token 0123456789 lives here';
      const wire = toWireError(new Error(secret));

      assert.notInclude(wire.message, secret);
      assert.notInclude(JSON.stringify(wire), secret);
      assert.notProperty(wire, 'stack');
    });

    it('uses the fixed message for a code, not the caller-supplied one', () => {
      const wire = toWireError(new BridgeError('HANDLER_ERROR', 'row id 42 not found for user bob'));

      assert.notInclude(wire.message, '42');
      assert.notInclude(wire.message, 'bob');
    });
  });

  describe('fromWireError', () => {
    BRIDGE_ERROR_CODES.forEach((code) => {
      it(`round-trips ${code}`, () => {
        const rebuilt = fromWireError(toWireError(new BridgeError(code)), 'a.topic');

        assert.instanceOf(rebuilt, BridgeError);
        assert.equal(rebuilt.code, code);
        assert.equal(rebuilt.topic, 'a.topic');
      });
    });

    [
      {name: 'an invented code', value: {code: 'TOTALLY_MADE_UP'}},
      {name: 'a non-string code', value: {code: 42}},
      {name: 'a missing code', value: {}},
      {name: 'a null error', value: null},
      {name: 'a string error', value: 'HANDLER_ERROR'},
      {name: 'a prototype-borrowed code', value: Object.create({code: 'TIMEOUT'})},
    ].forEach(({name, value}) => {
      it(`maps ${name} to HANDLER_ERROR`, () => {
        assert.equal(fromWireError(value).code, 'HANDLER_ERROR');
      });
    });
  });
});

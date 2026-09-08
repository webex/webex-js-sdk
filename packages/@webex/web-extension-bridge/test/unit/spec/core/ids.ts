import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {BridgeError} from '../../../../src/core/errors';
import {createIdFactory, isUsableCrypto} from '../../../../src/core/ids';

describe('core/ids', () => {
  describe('isUsableCrypto', () => {
    [
      {name: 'randomUUID only', value: {randomUUID: () => 'x'}, usable: true},
      {name: 'getRandomValues only', value: {getRandomValues: (a: Uint8Array) => a}, usable: true},
      {name: 'an empty object', value: {}, usable: false},
      {name: 'null', value: null, usable: false},
      {name: 'undefined', value: undefined, usable: false},
      {name: 'a non-callable randomUUID', value: {randomUUID: 'nope'}, usable: false},
      {name: 'Math', value: Math, usable: false},
    ].forEach(({name, value, usable}) => {
      it(`treats ${name} as ${usable ? 'usable' : 'unusable'}`, () => {
        assert.equal(isUsableCrypto(value), usable);
      });
    });
  });

  describe('createIdFactory', () => {
    it('fails closed when no CSPRNG is available, rather than falling back', () => {
      try {
        createIdFactory({});
        assert.fail('expected a throw');
      } catch (error) {
        assert.instanceOf(error, BridgeError);
        assert.equal((error as BridgeError).code, 'CRYPTO_UNAVAILABLE');
      }
    });

    it('prefers randomUUID', () => {
      const randomUUID = sinon.stub().returns('uuid-value');
      const nextId = createIdFactory({randomUUID});

      assert.equal(nextId(), 'uuid-value');
      assert.calledOnceWithExactly(randomUUID);
    });

    it('falls back to getRandomValues and produces 32 hex characters', () => {
      const getRandomValues = sinon.stub().callsFake((array: Uint8Array) => {
        array.fill(0xab);

        return array;
      });
      const nextId = createIdFactory({getRandomValues});

      assert.equal(nextId(), 'ab'.repeat(16));
      assert.calledOnce(getRandomValues);
    });

    it('zero-pads low bytes so every id is the same length', () => {
      const nextId = createIdFactory({
        getRandomValues: (array: Uint8Array) => {
          array.fill(0x01);

          return array;
        },
      });

      assert.equal(nextId(), '01'.repeat(16));
      assert.lengthOf(nextId(), 32);
    });

    it('uses the ambient crypto when none is given', () => {
      const nextId = createIdFactory();

      assert.notEqual(nextId(), nextId());
    });

    it('produces unguessable, unique ids', () => {
      const nextId = createIdFactory();
      const ids = new Set(Array.from({length: 500}, () => nextId()));

      assert.equal(ids.size, 500);
    });
  });
});

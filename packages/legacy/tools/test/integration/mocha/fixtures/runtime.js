/* eslint-env mocha */
import { strict as assert } from 'assert';
import defineProperty from '@babel/runtime-corejs2/core-js/object/define-property';

describe('Mocha runtime loading', () => {
  it('transpiles workspace imports without transforming runtime dependencies', () => {
    const result = {};

    defineProperty(result, 'value', { value: 42 });
    assert.equal(result.value, 42);
  });
});

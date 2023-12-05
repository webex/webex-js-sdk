import {assert} from '@webex/test-helper-chai';
import {sortScope, filterScope, diffScopes} from '@webex/webex-core/src/lib/credentials/scope';

describe('webex-core', () => {
  describe('scope utils', () => {
    describe('sortScope', () => {
      it('should sort scopes alphabetically', () => {
        assert.equal(sortScope(undefined), '');
        assert.equal(sortScope(''), '');
        assert.equal(sortScope('a'), 'a');
        assert.equal(sortScope('b c a'), 'a b c');
      });
    });

    describe('filterScope', () => {
      it('should filter out one scope from the original scope and sort the result', () => {
        assert.equal(filterScope('a', undefined), '');
        assert.equal(filterScope('a', ''), '');
        assert.equal(filterScope('a', 'a'), '');
        assert.equal(filterScope('a', 'a b c'), 'b c');
        assert.equal(filterScope('c', 'a c b'), 'a b');
      });

      it('should filter out a list of scopes from the original scope and sort the result', () => {
        assert.equal(filterScope([], 'a'), 'a');
        assert.equal(filterScope(['a', 'b'], undefined), '');
        assert.equal(filterScope(['a', 'b'], ''), '');
        assert.equal(filterScope(['a', 'b'], 'a'), '');
        assert.equal(filterScope(['a', 'b'], 'a b c'), 'c');
        assert.equal(filterScope(['a', 'd'], 'a c a b'), 'b c');
      });
    });

    describe('diffScopes', () => {
      it('should return an empty string, if all items in the first scope are contained in the second scope', () => {
        assert.deepEqual(diffScopes(undefined, undefined), '');
        assert.deepEqual(diffScopes(undefined, ''), '');
        assert.deepEqual(diffScopes('', undefined), '');
        assert.deepEqual(diffScopes('', ''), '');
        assert.deepEqual(diffScopes('a', 'a'), '');
        assert.deepEqual(diffScopes('a b c', 'a b c'), '');
        assert.deepEqual(diffScopes(undefined, 'a b c'), '');
        assert.deepEqual(diffScopes('a b c', 'a b c d'), '');
      });

      it('should return a string containing all items in the first scope that are not in the second scope', () => {
        assert.deepEqual(diffScopes('a', undefined), 'a');
        assert.deepEqual(diffScopes('a', 'b'), 'a');
        assert.deepEqual(diffScopes('a b c', 'a b'), 'c');
        assert.deepEqual(diffScopes('a b c d', 'a b c'), 'd');
        assert.deepEqual(diffScopes('a b c', undefined), 'a b c');
      });
    });
  });
});

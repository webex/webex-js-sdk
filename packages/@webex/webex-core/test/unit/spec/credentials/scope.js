import {assert} from '@webex/test-helper-chai';
import {
  sortScope,
  filterScope,
  diffScopes,
  isGuestScope,
} from '@webex/webex-core/src/lib/credentials/scope';

describe('webex-core', () => {
  describe('scope utils', () => {
    describe('sortScope', () => {
      [
        {scope: undefined, expected: ''},
        {scope: '', expected: ''},
        {scope: 'a', expected: 'a'},
        {scope: 'b c a', expected: 'a b c'},
      ].forEach(({scope, expected}) =>
        it(`should sort "${scope}" alphabetically`, () => {
          assert.equal(sortScope(scope), expected);
        })
      );
    });

    describe('filterScope', () => {
      [
        {toFilter: 'a', scope: undefined, expected: ''},
        {toFilter: 'a', scope: '', expected: ''},
        {toFilter: 'a', scope: 'a', expected: ''},
        {toFilter: 'a', scope: 'a b c', expected: 'b c'},
        {toFilter: 'c', scope: 'a c b', expected: 'a b'},
      ].forEach(({toFilter, scope, expected}) =>
        it(`should filter out ${toFilter} scope from ${scope} scope and sort the result`, () => {
          assert.equal(filterScope(toFilter, scope), expected);
        })
      );

      [
        {toFilter: [], scope: 'a', expected: 'a'},
        {toFilter: ['a', 'b'], scope: undefined, expected: ''},
        {toFilter: ['a', 'b'], scope: '', expected: ''},
        {toFilter: ['a', 'b'], scope: 'a', expected: ''},
        {toFilter: ['a', 'b'], scope: 'a b c', expected: 'c'},
        {toFilter: ['a', 'd'], scope: 'a c a b', expected: 'b c'},
      ].forEach(({toFilter, scope, expected}) =>
        it(`should filter out ${toFilter} from ${scope} and sort the result`, () => {
          assert.equal(filterScope(toFilter, scope), expected);
        })
      );
    });

    describe('diffScopes', () => {
      [
        {scope1: undefined, scope2: undefined, expected: ''},
        {scope1: undefined, scope2: '', expected: ''},
        {scope1: '', scope2: undefined, expected: ''},
        {scope1: '', scope2: '', expected: ''},
        {scope1: 'a', scope2: 'a', expected: ''},
        {scope1: 'a b c', scope2: 'a b c', expected: ''},
        {scope1: undefined, scope2: 'a b c', expected: ''},
        {scope1: 'a b c', scope2: 'a b c d', expected: ''},
      ].forEach(({scope1, scope2, expected}) =>
        it(`should return an empty string, when all items in ${scope1} scope are contained in the ${scope2} scope`, () => {
          assert.deepEqual(diffScopes(scope1, scope2), expected);
        })
      );

      [
        {scope1: 'a', scope2: undefined, expected: 'a'},
        {scope1: 'a', scope2: 'b', expected: 'a'},
        {scope1: 'a b c', scope2: 'a b', expected: 'c'},
        {scope1: 'a b c d', scope2: 'a b c', expected: 'd'},
        {scope1: 'a b c', scope2: undefined, expected: 'a b c'},
      ].forEach(({scope1, scope2, expected}) =>
        it(`should return a string containing all items in the ${scope1} scope that are not in the ${scope2} scope`, () => {
          assert.deepEqual(diffScopes(scope1, scope2), expected);
        })
      );
    });
  });
});

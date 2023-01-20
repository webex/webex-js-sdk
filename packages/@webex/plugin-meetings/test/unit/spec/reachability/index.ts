import {assert} from '@webex/test-helper-chai';
import Reachability from '@webex/plugin-meetings/src/reachability/';

describe('isAnyClusterReachable', () => {
  before(function () {
    this.jsdom = require('jsdom-global')('', {url: 'http://localhost'});
  });
  after(function () {
    this.jsdom();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  const checkIsClusterReachable = (mockStorage: any, expectedValue: boolean) => {
    if (mockStorage) {
      window.localStorage.setItem('reachability.result', JSON.stringify(mockStorage));
    }
    const reachability = new Reachability({});

    const result = reachability.isAnyClusterReachable();

    assert.equal(result, expectedValue);
  };

  it('returns true when udp is reachable', () => {
    checkIsClusterReachable({x: {udp: {reachable: 'true'}, tcp: {reachable: 'false'}}}, true);
  });

  it('returns true when tcp is reachable', () => {
    checkIsClusterReachable({x: {udp: {reachable: 'false'}, tcp: {reachable: 'true'}}}, true);
  });

  it('returns true when both tcp and udp are reachable', () => {
    checkIsClusterReachable({x: {udp: {reachable: 'true'}, tcp: {reachable: 'true'}}}, true);
  });

  it('returns false when both tcp and udp are unreachable', () => {
    checkIsClusterReachable({x: {udp: {reachable: 'false'}, tcp: {reachable: 'false'}}}, false);
  });

  it('returns false when reachability result is empty', () => {
    checkIsClusterReachable({x: {}}, false);
  });

  it('returns false when reachability.result item is not there', () => {
    checkIsClusterReachable(undefined, false);
  });
});

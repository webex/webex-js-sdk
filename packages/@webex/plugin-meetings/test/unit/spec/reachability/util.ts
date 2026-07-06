import {assert} from '@webex/test-helper-chai';

import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
  isReachabilityEnabled,
  resolveReachabilityProtocols,
} from '@webex/plugin-meetings/src/reachability/util';

describe('plugin-meetings/src/reachability/util', () => {
  describe('#resolveReachabilityProtocols()', () => {
    [
      {title: 'undefined defaults to all enabled', config: undefined, expected: {udp: true, tcp: true, tls: true}},
      {title: 'true enables all protocols', config: true, expected: {udp: true, tcp: true, tls: true}},
      {title: 'false disables all protocols', config: false, expected: {udp: false, tcp: false, tls: false}},
      {title: 'empty object keeps udp on and defaults tcp/tls to enabled', config: {}, expected: {udp: true, tcp: true, tls: true}},
      {title: 'object can disable tcp', config: {tcp: false}, expected: {udp: true, tcp: false, tls: true}},
      {title: 'object can disable tls', config: {tls: false}, expected: {udp: true, tcp: true, tls: false}},
      {title: 'object can disable both tcp and tls but udp stays on', config: {tcp: false, tls: false}, expected: {udp: true, tcp: false, tls: false}},
    ].forEach(({title, config, expected}) => {
      it(`resolves: ${title}`, () => {
        assert.deepEqual(resolveReachabilityProtocols(config as any), expected);
      });
    });
  });

  describe('#isReachabilityEnabled()', () => {
    [
      {title: 'undefined', config: undefined, expected: true},
      {title: 'true', config: true, expected: true},
      {title: 'false', config: false, expected: false},
      {title: 'object disabling tcp and tls (udp still on)', config: {tcp: false, tls: false}, expected: true},
    ].forEach(({title, config, expected}) => {
      it(`returns ${expected} for ${title}`, () => {
        assert.equal(isReachabilityEnabled(config as any), expected);
      });
    });
  });

  describe('#convertStunUrlToTurn()', () => {
    [
      {
        title: 'a stun url with port',
        stunUrl: 'stun:external-media91.public.wjfkm-a-10.prod.infra.webex.com:5004',
        expectedUrlPart: 'external-media91.public.wjfkm-a-10.prod.infra.webex.com:5004',
      },
      {
        title: 'a stun url without port',
        stunUrl: 'stun:something.somewhere.com',
        expectedUrlPart: 'something.somewhere.com',
      },
    ].forEach(({title, stunUrl, expectedUrlPart}) => {
      it(`should convert ${title} to a TCP turn url`, () => {
        const turnUrl = convertStunUrlToTurn(stunUrl, 'tcp');

        assert.equal(turnUrl, `turn:${expectedUrlPart}?transport=tcp`);
      });

      it(`should convert ${title} to a UDP turn url`, () => {
        const turnUrl = convertStunUrlToTurn(stunUrl, 'udp');

        assert.equal(turnUrl, `turn:${expectedUrlPart}`);
      });
    });

    it('show fail if stunUrl is not a valid url', () => {
      assert.throws(() => convertStunUrlToTurn('not a url', 'tcp'), 'Invalid URL: not a url');
    });

    it('show fail if stunUrl is not a STUN url', () => {
      assert.throws(
        () => convertStunUrlToTurn('http://webex.com', 'tcp'),
        'Not a STUN URL: http://webex.com'
      );
    });
  });

  describe('#convertStunUrlToTurnTls()', () => {
    it(`should convert to a turns url`, () => {
      const turnsUrl = convertStunUrlToTurnTls(
        'stun:external-media91.public.wjfkm-a-10.prod.infra.webex.com:443'
      );

      assert.equal(
        turnsUrl,
        'turns:external-media91.public.wjfkm-a-10.prod.infra.webex.com:443?transport=tcp'
      );
    });

    it('show fail if stunUrl is not a valid url', () => {
      assert.throws(() => convertStunUrlToTurn('not a url', 'tcp'), 'Invalid URL: not a url');
    });

    it('show fail if stunUrl is not a STUN url', () => {
      assert.throws(
        () => convertStunUrlToTurn('http://webex.com', 'tcp'),
        'Not a STUN URL: http://webex.com'
      );
    });
  });
});

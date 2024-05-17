import {assert} from '@webex/test-helper-chai';

import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
} from '@webex/plugin-meetings/src/reachability/util';

describe('plugin-meetings/src/reachability/util', () => {
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
    [
      {
        title: 'a stun url with port',
        stunUrl: 'stun:external-media91.public.wjfkm-a-10.prod.infra.webex.com:443',
         : 'external-media91.public.wjfkm-a-10.prod.infra.webex.com:443',
      },
      {
        title: 'a stun url without port',
        stunUrl: 'stun:something.somewhere.com',
        expectedUrlPart: 'something.somewhere.com',
      },
    ].forEach(({title, stunUrl, expectedUrlPart}) => {
      it(`should convert ${title} to a TCP turn url`, () => {
        const turnUrl = convertStunUrlToTurnTls(stunUrl);

        assert.equal(turnUrl, `turn:${expectedUrlPart}?transport=tcp`);
      });

      it(`should convert ${title} to a UDP turn url`, () => {
        const turnUrl = convertStunUrlToTurnTls(stunUrl);

        assert.equal(turnUrl, `turn:${expectedUrlPart}:443?transport=tcp`);
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
});

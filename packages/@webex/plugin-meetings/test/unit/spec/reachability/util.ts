import {assert} from '@webex/test-helper-chai';

import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
  parseIceServerUrl,
  prepopulateSubnetDetails,
} from '@webex/plugin-meetings/src/reachability/util';

describe('plugin-meetings/src/reachability/util', () => {
  describe('#parseIceServerUrl()', () => {
    [
      {
        title: 'a stun url with IPv4 and port',
        url: 'stun:1.2.3.4:5004',
        expected: {host: '1.2.3.4', port: 5004, isIp: true},
      },
      {
        title: 'a stun url with IPv4 without port',
        url: 'stun:1.2.3.4',
        expected: {host: '1.2.3.4', port: undefined, isIp: true},
      },
      {
        title: 'a stun url with domain name and port',
        url: 'stun:server.example.com:3478',
        expected: {host: 'server.example.com', port: 3478, isIp: false},
      },
      {
        title: 'a stun url with domain name without port',
        url: 'stun:server.example.com',
        expected: {host: 'server.example.com', port: undefined, isIp: false},
      },
      {
        title: 'a stun url with IPv6 in brackets and port',
        url: 'stun:[2402:2500::1]:5004',
        expected: {host: '2402:2500::1', port: 5004, isIp: true},
      },
      {
        title: 'a stun url with IPv6 in brackets without port',
        url: 'stun:[2402:2500::1]',
        expected: {host: '2402:2500::1', port: undefined, isIp: true},
      },
      {
        title: 'a turn url with IPv4 and port',
        url: 'turn:1.2.3.4:443?transport=tcp',
        expected: {host: '1.2.3.4', port: 443, isIp: true},
      },
      {
        title: 'a turns url with domain name and port',
        url: 'turns:server.example.com:443?transport=tcp',
        expected: {host: 'server.example.com', port: 443, isIp: false},
      },
    ].forEach(({title, url, expected}) => {
      it(`should parse ${title}`, () => {
        assert.deepEqual(parseIceServerUrl(url), expected);
      });
    });

    it('returns isIp:false for an invalid url', () => {
      assert.deepEqual(parseIceServerUrl('not a url'), {isIp: false});
    });

    it('returns isIp:false for a non STUN/TURN scheme', () => {
      assert.deepEqual(parseIceServerUrl('http://webex.com'), {isIp: false});
    });

    it('returns isIp:false for an invalid IPv6 in brackets', () => {
      assert.deepEqual(parseIceServerUrl('stun:[not::valid::ipv6::addr]:5004'), {isIp: false});
    });
  });

  describe('#prepopulateSubnetDetails()', () => {
    const makeDetail = (serverIp: string, port: number) => ({
      serverIp,
      port,
      answeredTx: 0,
      lostTx: 1,
      latencies: [],
    });

    it('returns an empty array for an empty list of urls', () => {
      assert.deepEqual(prepopulateSubnetDetails([]), []);
    });

    it('includes only IP-based urls by default (skips domain names)', () => {
      const urls = [
        'stun:1.2.3.4:5004',
        'stun:[2402:2500::1]:5004',
        'stun:server.example.com:3478',
      ];

      assert.deepEqual(prepopulateSubnetDetails(urls), [
        makeDetail('1.2.3.4', 5004),
        makeDetail('2402:2500::1', 5004),
      ]);
    });

    it('includes domain names when includeDomains is true', () => {
      const urls = [
        'stun:1.2.3.4:5004',
        'stun:server.example.com:3478',
      ];

      assert.deepEqual(prepopulateSubnetDetails(urls, true), [
        makeDetail('1.2.3.4', 5004),
        makeDetail('server.example.com', 3478),
      ]);
    });

    it('skips urls without a port', () => {
      const urls = ['stun:1.2.3.4', 'stun:server.example.com', 'stun:[2402:2500::1]'];

      assert.deepEqual(prepopulateSubnetDetails(urls, true), []);
    });

    it('skips invalid urls', () => {
      assert.deepEqual(prepopulateSubnetDetails(['not a url', 'http://webex.com']), []);
    });

    it('deduplicates entries with the same host and port', () => {
      const urls = [
        'stun:1.2.3.4:5004',
        'stun:1.2.3.4:5004',
        'turn:1.2.3.4:5004?transport=tcp',
      ];

      assert.deepEqual(prepopulateSubnetDetails(urls), [makeDetail('1.2.3.4', 5004)]);
    });

    it('does not deduplicate entries with the same host but different ports', () => {
      const urls = ['stun:1.2.3.4:5004', 'stun:1.2.3.4:443'];

      assert.deepEqual(prepopulateSubnetDetails(urls), [
        makeDetail('1.2.3.4', 5004),
        makeDetail('1.2.3.4', 443),
      ]);
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
      assert.throws(() => convertStunUrlToTurn('not a url', 'tcp'), 'Invalid URL');
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
      assert.throws(() => convertStunUrlToTurn('not a url', 'tcp'), 'Invalid URL');
    });

    it('show fail if stunUrl is not a STUN url', () => {
      assert.throws(
        () => convertStunUrlToTurn('http://webex.com', 'tcp'),
        'Not a STUN URL: http://webex.com'
      );
    });
  });
});

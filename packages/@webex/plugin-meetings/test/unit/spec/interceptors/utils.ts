import 'jsdom-global/register';
import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {isJwtTokenExpired} from '@webex/plugin-meetings/src/interceptors/utils';

const makeJwt = (payload) =>
  [
    Buffer.from(JSON.stringify({alg: 'none', typ: 'JWT'})).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    ''
  ].join('.');

describe('plugin-meetings', () => {
  describe('Interceptors', () => {
    describe('utils - isJwtTokenExpired', () => {
      let clock;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
      });

      afterEach(() => {
        sinon.restore();
        clock.restore();
      });

      it('returns false when token has no exp', () => {
        const token = makeJwt({}); // no exp

        const result = isJwtTokenExpired(token);

        expect(result).to.equal(false);
      });

      it('returns false when token is not expired', () => {
        const now = Date.now();
        const futureExp = Math.floor((now + 60 * 1000) / 1000);

        const token = makeJwt({exp: futureExp});

        const result = isJwtTokenExpired(token);

        expect(result).to.equal(false);
      });

      it('returns true when token is expired', () => {
        const now = Date.now();
        const pastExp = Math.floor((now - 60 * 1000) / 1000);

        const token = makeJwt({exp: pastExp});

        const result = isJwtTokenExpired(token);

        expect(result).to.equal(true);
      });

      it('returns true when token expires within EXPIRY_BUFFER', () => {
        const now = Date.now();
        const expSoon = Math.floor((now + 10 * 1000) / 1000);

        const token = makeJwt({exp: expSoon});

        const result = isJwtTokenExpired(token);

        expect(result).to.equal(true);
      });

      it('returns true when token is invalid', () => {
        const result = isJwtTokenExpired('not-a-jwt');

        expect(result).to.equal(true);
      });
    });
  });
});

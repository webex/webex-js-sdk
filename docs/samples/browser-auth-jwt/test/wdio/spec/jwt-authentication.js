import {createUser} from '@webex/test-helper-appid';
import uuid from 'uuid';
import {expect} from 'chai';

describe('Authentication - Guest Users (JWT)', () => {
  describe('authenticate using jwt', () => {
    let spockJwt;

    before('creates spock jwt', () => createUser({displayName: `test-${uuid.v4()}`})
      .then(({jwt}) => {
        spockJwt = jwt;
      }));

    before('reload browser', () => {
      browser.refresh();
    });

    it('browses to sample app and verifies the user is not authenticated', () => {
      browser.url('/browser-auth-jwt');
      browser.$('[placeholder="JSON Web Token"]').waitForExist();

      expect(browserFirefox.$('#authentication-status').getText()).to.equal('Not Authenticated');
      expect(browserChrome.$('#authentication-status').getText()).to.equal('Not Authenticated');
    });

    describe('initiates jwt authentication', () => {
      before(() => browser.$('[placeholder="JSON Web Token"]').setValue(spockJwt));

      it('in Firefox', () => {
        browserFirefox.$('[title="authenticate"]').click();

        browserFirefox.pause(10000);

        browserFirefox.waitUntil(
          () => browserFirefox.$('#authentication-status').getText() === 'Authenticated',
          {
            timeout: 10000,
            timeoutMsg: 'expected authentication status to be Authenticated in browserFirefox'
          }
        );

        expect(browserFirefox.$('#authentication-status').getText()).to.equal('Authenticated');
      });

      it('in Chrome', () => {
        browserChrome.$('[title="authenticate"]').click();

        browserChrome.pause(10000);

        browserChrome.waitUntil(
          () => browserChrome.$('#authentication-status').getText() === 'Authenticated',
          {
            timeout: 10000,
            timeoutMsg: 'expected authentication status to be Authenticated in browserChrome'
          }
        );

        expect(browserChrome.$('#authentication-status').getText()).to.equal('Authenticated');
      });
    });
  });
});

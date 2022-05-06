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

    before('reload browser', async () => {
      await browser.refresh();
    });

    it('browses to sample app and verifies the user is not authenticated', async () => {
      await browser.url('/samples/browser-auth-jwt');
      await (await browser.$('[placeholder="JSON Web Token"]')).waitForExist();

      await expect(await (await browserFirefox.$('#authentication-status')).getText()).to.equal('Not Authenticated');
      await expect(await (await browserChrome.$('#authentication-status')).getText()).to.equal('Not Authenticated');
    });

    describe('initiates jwt authentication', () => {
      before(async () => await (await browser.$('[placeholder="JSON Web Token"]')).setValue(spockJwt));

      it('in Firefox', async () => {
        await (await browserFirefox.$('[title="authenticate"]')).click();

        await browserFirefox.pause(10000);

        await browserFirefox.waitUntil(
          async () => (await (await browserFirefox.$('#authentication-status')).getText()) === 'Authenticated',
          {
            timeout: 10000,
            timeoutMsg: 'expected authentication status to be Authenticated in browserFirefox'
          }
        );

        await expect(await (await browserFirefox.$('#authentication-status')).getText()).to.equal('Authenticated');
      });

      it('in Chrome', async () => {
        await (await browserChrome.$('[title="authenticate"]')).click();

        await browserChrome.pause(10000);

        await browserChrome.waitUntil(
          async () => (await (await browserChrome.$('#authentication-status')).getText()) === 'Authenticated',
          {
            timeout: 10000,
            timeoutMsg: 'expected authentication status to be Authenticated in browserChrome'
          }
        );

        await expect(await (await browserChrome.$('#authentication-status')).getText()).to.equal('Authenticated');
      });
    });
  });
});

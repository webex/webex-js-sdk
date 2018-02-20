import {createUser} from '@ciscospark/test-helper-appid';
import uuid from 'uuid';

describe('samples/browser-auth-jwt', () => {
  describe('authenticate using jwt', () => {
    const browserSpock = browser.select('browserSpock');
    let spockJwt;

    before('creates spock jwt', () => createUser({displayName: `test-${uuid.v4()}`})
      .then(({jwt}) => {
        spockJwt = jwt;
      }));

    before('reload browser', () => {
      browser.select('browserSpock').reload();
      browser.select('browserMccoy').reload();
    });

    it('browses to sample app and verifies the user is not authenticated', () => {
      browserSpock.url('/browser-auth-jwt');
      browserSpock.assertText('#authentication-status', 'Not Authenticated');
    });

    it('initiates jwt authentication', () => {
      browserSpock.setValueInDOM('[placeholder="JSON Web Token"]', spockJwt);
      browserSpock.click('[title="authenticate"]');
      browserSpock.waitForSpecificText('#authentication-status', 'Authenticated', 30000);
    });
  });
});

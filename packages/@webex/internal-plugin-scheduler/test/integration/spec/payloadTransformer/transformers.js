import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import testUsers from '@webex/test-helper-test-users';
import WebexCore from '@webex/webex-core';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

/**
 * Integration tests use a real webex test user against services.
 */
describe('plugin-scheduler', () => {
  describe('transformers', () => {
    let scheduler;
    let user;
    let webex;

    beforeEach(() => {
      testUsers.create({count: 1}).then(([createdUser]) => {
        user = createdUser;

        webex = new WebexCore({
          credentials: user.token,
        });

        scheduler = webex.internal.scheduler;
      });
    });

    /**
     * Integration test scope, typically methods/name or event/name.
     */
    describe('{scope}', () => {
      // TODO - Add integration tests.
      it('example test', () => {
        assert.isTrue(true);
      });
    });
  });
});

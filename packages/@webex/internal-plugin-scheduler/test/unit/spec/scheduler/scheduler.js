import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';

import Scheduler from '@webex/internal-plugin-scheduler';

/**
 * Unit tests are not used against services.
 */
describe('plugin-scheduler', () => {
  describe('Scheduler', () => {
    let webex;
    let scheduler;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          scheduler: Scheduler,
        },
      });

      scheduler = webex.internal.scheduler;
    });

    /**
     * Any expected property assignments to this scope.
     */
    describe('properties', () => {
      describe('request', () => {
        it('should be mounted', () => {
          assert.exists(scheduler.request);
        });
      });

      describe('logger', () => {
        it('should be mounted', () => {
          assert.exists(scheduler.logger);
        });
      });

      // TODO - Test additional properties.
    });

    /**
     * Any expected event workflows assigned to this scope.
     */
    describe('events', () => {
      // TODO - Add event testing.
    });

    /**
     * Any methods assigned to this scope.
     */
    describe('methods', () => {
      // TODO - Add method testing.
    });
  });
});

import {assert} from '@webex/test-helper-chai';
import Breakout from '@webex/plugin-meetings/src/breakouts/breakout';
import BreakoutCollection from '@webex/plugin-meetings/src/breakouts/collection';

describe('plugin-meetings', () => {
  describe('BreakoutCollection', () => {
    it('the breakout collection is as expected', () => {
      const collection = new BreakoutCollection();

      assert.equal(collection.model, Breakout);
      assert.equal(collection.namespace, 'Meetings');
      assert.equal(collection.mainIndex, 'sessionId');
    });
  });
});

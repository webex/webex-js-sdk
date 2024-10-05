import {assert} from '@webex/test-helper-chai';
import WebinarCollection from '@webex/plugin-meetings/src/webinar/collection';

describe('plugin-meetings', () => {
    describe('WebinarCollection', () => {
        it('the webinar collection is as expected', () => {
            const collection = new WebinarCollection();

            assert.equal(collection.namespace, 'Meetings');
            assert.equal(collection.mainIndex, 'sessionId');
        });
    });
});

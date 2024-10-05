import {assert} from '@webex/test-helper-chai';
import SILanguage from '@webex/plugin-meetings/src/interpretation/siLanguage';
import SILanguageCollection from '@webex/plugin-meetings/src/interpretation/collection';

describe('plugin-meetings', () => {
  describe('SILanguageCollection', () => {
    it('the siLanguages collection is as expected', () => {
      const collection = new SILanguageCollection();

      assert.equal(collection.model, SILanguage);
      assert.equal(collection.namespace, 'Meetings');
      assert.equal(collection.mainIndex, 'languageName');
    });
  });
});

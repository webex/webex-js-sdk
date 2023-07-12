import {assert} from '@webex/test-helper-chai';
import SILanguage from '@webex/plugin-meetings/src/interpretation/siLanguage';
import SimultaneousInterpretation from '@webex/plugin-meetings/src/interpretation';
import MockWebex from '@webex/test-helper-mock-webex';

describe.only('plugin-meetings', () => {
  describe('SILanguage', () => {
    let webex;
    let siLanguage;
    let interpretation;
    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      interpretation = new SimultaneousInterpretation({}, {parent: webex});
      siLanguage = new SILanguage({}, {parent: interpretation});
    });
    it('set siLanguage props correctly', () => {
      siLanguage.set({
        languageCode: 20,
        languageName: 'en',
      });
      assert.equal(siLanguage.languageCode, 20);
      assert.equal(siLanguage.languageName, 'en');
    });
  });
});

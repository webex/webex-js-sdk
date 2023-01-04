import {assert} from '@webex/test-helper-chai';
import {cloneDeep} from 'lodash';

import EmbeddedAppUtils from '@webex/plugin-meetings/src/locus-info/embeddedAppsUtils';

describe('plugin-meetings', () => {
  describe('embeddedAppsUtils', () => {
    const slidoApp = {
      url: 'https://hecate-b.wbx2.com/apps/api/v1/locus/7a4994a7',
      sequence: 138849877016800000,
      appId:
        'Y2lzY29zcGFyazovL3VzL0FQUExJQ0FUSU9OLzQxODc1MGQ0LTM3ZDctNGY2MC1hOWE3LWEwZTE1NDFhNjRkNg',
      instanceInfo: {
        appInstanceUrl:
          'https://webex.sli.do/participant/event/mFKKjcYxzx9h31eyWgngFS?clusterId=eu1',
        externalAppInstanceUrl: '',
        title: 'Active session',
      },
      state: 'STARTED',
      lastModified: '2022-10-13T21:01:41.680Z',
    };
    const otherApp = {
      url: 'https://hecate-b.wbx2.com/apps/api/v1/locus/7a4994a7',
      sequence: 138849877016800000,
      appId: 'some-other-app-id',
      instanceInfo: {
        appInstanceUrl: 'https://webex.someotherapp.com/mFKKjcYxzx9h31eyWgngFS?clusterId=eu1',
        externalAppInstanceUrl: '',
        title: 'Active session',
      },
      state: 'STARTED',
      lastModified: '2022-10-13T21:01:31.680Z',
    };

    describe('parseApp', () => {
      it('returns a parsed embedded app with type of SLIDO', () => {
        const parsedApp = EmbeddedAppUtils.parseApp(slidoApp);
        const expectedApp = {...slidoApp, ...{type: 'SLIDO'}};

        assert.deepEqual(parsedApp, expectedApp);
      });

      it('returns a parsed embedded app with type of OTHER', () => {
        const parsedApp = EmbeddedAppUtils.parseApp(otherApp);
        const expectedApp = {...otherApp, ...{type: 'OTHER'}};

        assert.deepEqual(parsedApp, expectedApp);
      });
    });

    describe('parse', () => {
      it('returns a copy of embeddedApps', () => {
        const embeddedApps = [slidoApp];
        const parsedApps = EmbeddedAppUtils.parse(embeddedApps);

        assert.notStrictEqual(parsedApps, embeddedApps);
        assert.equal(parsedApps.length, embeddedApps.length);
      });
    });

    describe('areSimilar', () => {
      it('returns true if the apps are the same', () => {
        const apps1 = [slidoApp];
        const apps2 = [cloneDeep(slidoApp)];

        const different = EmbeddedAppUtils.areSimilar(apps1, apps2);

        assert.equal(different, true);
      });

      it('returns false if the number of apps is different', () => {
        const apps1 = [slidoApp];
        const apps2 = [cloneDeep(slidoApp), cloneDeep(slidoApp)];

        const different = EmbeddedAppUtils.areSimilar(apps1, apps2);

        assert.equal(different, false);
      });

      it('returns false if the state of the first apps is different', () => {
        const apps1 = [slidoApp];
        const apps2 = [cloneDeep(slidoApp)];

        apps2[0].state = 'STOPPED';

        const different = EmbeddedAppUtils.areSimilar(apps1, apps2);

        assert.equal(different, false);
      });

      it('handles null apps', () => {
        assert.equal(EmbeddedAppUtils.areSimilar(null, null), true);
        assert.equal(EmbeddedAppUtils.areSimilar(null, [slidoApp]), false);
        assert.equal(EmbeddedAppUtils.areSimilar([slidoApp], null), false);
      });

      it('handles empty apps', () => {
        assert.equal(EmbeddedAppUtils.areSimilar([], []), true);
        assert.equal(EmbeddedAppUtils.areSimilar([], [slidoApp]), false);
        assert.equal(EmbeddedAppUtils.areSimilar([slidoApp], []), false);
      });
    });
  });
});

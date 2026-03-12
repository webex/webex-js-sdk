/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import WebexCore from '@webex/webex-core';
import '@webex/internal-plugin-dss';

describe('plugin-dss search integration (browser)', function () {
  this.timeout(60000);

  let webex;

  before(() =>
    testUsers.create({count: 1}).then(([user]) => {
      webex = new WebexCore({
        credentials: user.token,
      });
    })
  );

  after(() => {
    if (webex && webex.internal.dss.registered) {
      return webex.internal.dss.unregister();
    }

    return Promise.resolve();
  });

  it('registers with DSS and searches for extension 9902', async () => {
    await webex.internal.dss.register();
    assert.isTrue(webex.internal.dss.registered);

    const results = await webex.internal.dss.search({
      requestedTypes: ['PERSON', 'CALLING_SERVICE', 'EXTERNAL_CALLING'],
      resultSize: 100,
      queryString: '9902',
    });

    assert.isArray(results);
    console.log('DSS search results for extension 9902:', JSON.stringify(results, null, 2));
  });
});

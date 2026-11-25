import {assert} from '@webex/test-helper-chai';
import * as httpCore from '@webex/http-core';
import sinon from 'sinon';

import {getMeetingTestUserProvisioning} from '../../../src';

describe('meeting test-user license discovery', () => {
  let request;
  const options = {
    authorization: 'Bearer admin-token',
    orgId: 'test-org',
    webexSite: 'meetings.example.webex.com',
    atlasServiceUrl: 'https://atlas.example.test/admin/api/v1/',
  };
  const basicLicenses = ['FTM', 'FTC', 'FMS'].map((offerCode) => ({
    offerCode,
    licenseID: `${offerCode}_org-license`,
    status: 'ACTIVE',
  }));
  const siteLicense = {
    offerCode: 'WXSFREE',
    licenseID: 'WXSFREE_site-license',
    siteUrl: options.webexSite,
    status: 'ACTIVE',
  };

  beforeEach(() => {
    request = sinon.stub(httpCore, 'request').resolves({body: [...basicLicenses, siteLicense]});
  });

  afterEach(() => sinon.restore());

  it('fetches synthetic licenses and selects the basic licenses and matching active site', async () => {
    request.resolves({
      body: [
        ...basicLicenses,
        {...siteLicense, siteUrl: 'other.webex.com', licenseID: 'WXSFREE_other-site'},
        {...siteLicense, status: 'SUSPENDED', licenseID: 'WXSFREE_suspended'},
        {offerCode: 'EE', status: 'ACTIVE', licenseID: 'EE_paid', siteUrl: options.webexSite},
        siteLicense,
      ],
    });

    assert.deepEqual(await getMeetingTestUserProvisioning(options), {
      webexSite: options.webexSite,
      licenseIds: [...basicLicenses.map(({licenseID}) => licenseID), siteLicense.licenseID],
    });
    assert.calledOnceWithExactly(request, {
      method: 'GET',
      uri: 'https://atlas.example.test/admin/api/v1/organizations/test-org/licenses',
      qs: {includeUsage: false, syntheticLicenses: true},
      json: true,
      headers: {
        authorization: options.authorization,
        trackingid: sinon.match(/^webex-js-sdk_test-users_[a-f\d-]{36}_\d+$/),
      },
    });
  });

  it.each(['FTM', 'FTC', 'FMS', 'WXSFREE'])('rejects a missing %s license', async (offerCode) => {
    request.resolves({
      body: [...basicLicenses, siteLicense].filter((license) => license.offerCode !== offerCode),
    });

    await assert.isRejected(
      getMeetingTestUserProvisioning(options),
      new RegExp(`Expected one active ${offerCode} license`)
    );
  });

  it('rejects multiple matching site licenses rather than choosing one arbitrarily', async () => {
    request.resolves({
      body: [...basicLicenses, siteLicense, {...siteLicense, licenseID: 'WXSFREE_second'}],
    });

    await assert.isRejected(getMeetingTestUserProvisioning(options), 'found 2');
  });

  it('rejects a malformed catalog response', async () => {
    request.resolves({body: {licenses: []}});

    await assert.isRejected(
      getMeetingTestUserProvisioning(options),
      'Expected an array from the organization license catalog'
    );
  });

  it('propagates lookup failures', async () => {
    const error = new Error('Atlas unavailable');
    request.rejects(error);

    assert.strictEqual(await assert.isRejected(getMeetingTestUserProvisioning(options)), error);
  });

  it('defaults to the first active site with a supported meeting license', async () => {
    const firstSite = {...siteLicense, licenseID: 'WXSFREE_first', siteUrl: 'first.webex.com'};
    request.resolves({
      body: [
        ...basicLicenses,
        {...siteLicense, status: 'SUSPENDED', siteUrl: 'suspended.webex.com'},
        {offerCode: 'EE', status: 'ACTIVE', licenseID: 'EE_paid', siteUrl: 'paid.webex.com'},
        {...siteLicense, siteUrl: ''},
        firstSite,
        siteLicense,
      ],
    });

    assert.deepEqual(await getMeetingTestUserProvisioning({...options, webexSite: undefined}), {
      webexSite: firstSite.siteUrl,
      licenseIds: [...basicLicenses.map(({licenseID}) => licenseID), firstSite.licenseID],
    });
  });

  it('discovers the site matching an explicit license override and preserves those IDs', async () => {
    const licenseIds = ['FTM_override', siteLicense.licenseID];
    request.resolves({
      body: [{...siteLicense, licenseID: 'WXSFREE_other', siteUrl: 'other.webex.com'}, siteLicense],
    });

    assert.deepEqual(
      await getMeetingTestUserProvisioning({
        ...options,
        webexSite: undefined,
        licenseIds,
      }),
      {webexSite: siteLicense.siteUrl, licenseIds}
    );
  });

  it('rejects an explicit site absent from the active catalog', async () => {
    await assert.isRejected(
      getMeetingTestUserProvisioning({
        ...options,
        webexSite: 'missing.webex.com',
      }),
      'found 0'
    );
  });

  it.each(['authorization', 'orgId'])(
    'rejects missing %s before requesting the catalog',
    async (key) => {
      await assert.isRejected(
        getMeetingTestUserProvisioning({...options, [key]: undefined}),
        'License discovery requires'
      );
      assert.notCalled(request);
    }
  );
});

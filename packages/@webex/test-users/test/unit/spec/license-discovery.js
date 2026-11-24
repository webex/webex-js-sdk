import {request} from '@webex/http-core';

import {getMeetingTestUserLicenseIds} from '../../../src';

jest.mock('@webex/http-core', () => ({request: jest.fn()}));

describe('meeting test-user license discovery', () => {
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
    request.mockReset();
    request.mockResolvedValue({body: [...basicLicenses, siteLicense]});
  });

  it('fetches synthetic licenses and selects the basic licenses and matching active site', async () => {
    request.mockResolvedValue({
      body: [
        ...basicLicenses,
        {...siteLicense, siteUrl: 'other.webex.com', licenseID: 'WXSFREE_other-site'},
        {...siteLicense, status: 'SUSPENDED', licenseID: 'WXSFREE_suspended'},
        {offerCode: 'EE', status: 'ACTIVE', licenseID: 'EE_paid', siteUrl: options.webexSite},
        siteLicense,
      ],
    });

    await expect(getMeetingTestUserLicenseIds(options)).resolves.toEqual([
      ...basicLicenses.map(({licenseID}) => licenseID),
      siteLicense.licenseID,
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      uri: 'https://atlas.example.test/admin/api/v1/organizations/test-org/licenses',
      qs: {includeUsage: false, syntheticLicenses: true},
      json: true,
      headers: {
        authorization: options.authorization,
        trackingid: expect.stringMatching(/^webex-js-sdk_test-users_[a-f\d-]{36}_\d+$/),
      },
    });
  });

  it.each(['FTM', 'FTC', 'FMS', 'WXSFREE'])('rejects a missing %s license', async (offerCode) => {
    request.mockResolvedValue({
      body: [...basicLicenses, siteLicense].filter((license) => license.offerCode !== offerCode),
    });

    await expect(getMeetingTestUserLicenseIds(options)).rejects.toThrow(
      new RegExp(`Expected one active ${offerCode} license`)
    );
  });

  it('rejects multiple matching site licenses rather than choosing one arbitrarily', async () => {
    request.mockResolvedValue({
      body: [...basicLicenses, siteLicense, {...siteLicense, licenseID: 'WXSFREE_second'}],
    });

    await expect(getMeetingTestUserLicenseIds(options)).rejects.toThrow('found 2');
  });

  it('rejects a malformed catalog response', async () => {
    request.mockResolvedValue({body: {licenses: []}});

    await expect(getMeetingTestUserLicenseIds(options)).rejects.toThrow(
      'Expected an array from the organization license catalog'
    );
  });

  it('propagates lookup failures', async () => {
    const error = new Error('Atlas unavailable');
    request.mockRejectedValue(error);

    await expect(getMeetingTestUserLicenseIds(options)).rejects.toBe(error);
  });

  it.each(['authorization', 'orgId', 'webexSite'])(
    'rejects missing %s before requesting the catalog',
    async (key) => {
      await expect(getMeetingTestUserLicenseIds({...options, [key]: undefined})).rejects.toThrow(
        'License discovery requires'
      );
      expect(request).not.toHaveBeenCalled();
    }
  );
});

// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {HTTP_VERBS, API, RESOURCE} from '../constants';
import type {
  GetSitePreferencesOptions,
  SitePreferencesResponse,
  SitePreferencesSelect,
} from './meetings.types';

const DEFAULT_SITE_PREFERENCES_SELECT = ['pmr', 'audioVideo', 'scheduling'];
const WEBEX_SITE_SUFFIX = '.webex.com';

const normalizeSiteUrl = (siteUrl: string) =>
  siteUrl
    .trim()
    .replace(/^(https?:)?\/\//, '')
    .split(/[/?#]/)[0];

const getSiteName = (siteUrl: string) => {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);

  return normalizedSiteUrl.endsWith(WEBEX_SITE_SUFFIX)
    ? normalizedSiteUrl.slice(0, -WEBEX_SITE_SUFFIX.length)
    : normalizedSiteUrl;
};

const getSelectQuery = (select?: SitePreferencesSelect | null) => {
  if (!select || (Array.isArray(select) && select.length === 0)) {
    return DEFAULT_SITE_PREFERENCES_SELECT.join(',');
  }

  return Array.isArray(select) ? select.join(',') : select;
};

/**
 * @class MeetingRequest
 */
export default class MeetingRequest extends StatelessWebexPlugin {
  /**
   *  get all the active meetings for the user
   * @returns {Array} return locus array
   */
  getActiveMeetings() {
    // @ts-ignore
    return this.request({
      api: API.LOCUS,
      resource: RESOURCE.LOCI,
    })
      .then((res) => this.determineRedirections(res.body))
      .catch((error) => {
        LoggerProxy.logger.error(
          `Meetings:request#getActiveMeetings --> failed to get locus details, ${error}`
        );
        throw new Error(error);
      });
  }

  /**
   *  fetch geoHit for the user
   * @returns {Promise<object>} geoHintInfo
   */
  fetchGeoHint() {
    // @ts-ignore
    return this.webex.internal.services.fetchClientRegionInfo();
  }

  /**
   * get user meeting preference information
   * @returns {Promise<object>} getMeetingPreferences
   */
  getMeetingPreferences() {
    // @ts-ignore
    return this.webex.internal.services.getMeetingPreferences();
  }

  /**
   * Get appapi site preferences for a Webex site.
   *
   * @param {object} options
   * @param {string} options.siteUrl - Webex site URL, for example "go.webex.com".
   * @param {string[]|string} [options.select] - Preference sections to fetch.
   * @param {string} [options.siteName] - Site name query override.
   * @returns {Promise<SitePreferencesResponse>} site preferences response body
   * @public
   * @memberof MeetingRequest
   */
  getSitePreferences({
    siteUrl,
    select,
    siteName,
  }: GetSitePreferencesOptions & {siteUrl: string}): Promise<SitePreferencesResponse> {
    const normalizedSiteUrl = normalizeSiteUrl(siteUrl);

    if (!normalizedSiteUrl) {
      return Promise.reject(
        new Error('No site URL available. Call register() first or provide options.siteUrl.')
      );
    }

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `https://${normalizedSiteUrl}/wbxappapi/v1/users/me/preference`,
      qs: {
        select: getSelectQuery(select),
        siteurl: siteName || getSiteName(normalizedSiteUrl),
      },
    }).then((res) => res.body);
  }

  // locus federation, determines and populate locus if the responseBody has remote URLs to fetch locus details

  /**
   *  Fetches indivdual locus rather then getting all at once
   * @param {object} responseBody determine the locus and fetch them if a remoteUrl is given
   * @returns {Promise}  returns locusObject array
   */
  determineRedirections(responseBody: any) {
    if (responseBody.remoteLocusClusterUrls && responseBody.remoteLocusClusterUrls.length) {
      return Promise.all(
        responseBody.remoteLocusClusterUrls.map((url) =>
          // @ts-ignore
          this.request({
            method: HTTP_VERBS.GET,
            url,
            runWhitelistedDomains: true, // allows auth token for whitelisted domain
          })
            .then((res) => {
              responseBody.loci = responseBody.loci.concat(res.body.loci);
              responseBody.locusUrls = responseBody.locusUrls.concat(res.body.locusUrls);

              return Promise.resolve(responseBody);
            })
            .catch((error) => {
              LoggerProxy.logger.error(
                `Meetings:request#determineRedirections --> failed to get locus details from url: ${url}, reason: ${error}`
              );
              throw new Error(error);
            })
        )
      ).then(() => Promise.resolve(responseBody));
    }

    return Promise.resolve(responseBody);
  }
}

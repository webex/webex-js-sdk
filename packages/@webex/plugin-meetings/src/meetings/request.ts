// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import ParameterError from '../common/errors/parameter';
import {HTTP_VERBS, API, RESOURCE} from '../constants';
import {
  DEFAULT_SITE_PREFERENCE_SELECT_OPTIONS,
  type FetchSitePreferencesMeViaSiteOptions,
  type SitePreferencesResponse,
} from './meetings.types';
import MeetingsUtil from './util';

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
   * Fetches site preferences from a given site given a select option and a siteUrl with an optional siteName. If siteName is not provided, it will be derived from the siteUrl. If siteUrl is not provided, it will throw an error. If selectOptions is not provided, it will default to scheduling.
   *
   * @param {object} [options]
   * @param {string} [options.siteUrl] - Webex site URL, for example "cisco.webex.com".
   * @param {string} [options.siteName] - Site name query override. Defaults to the site name derived from options.siteUrl, e.g., "cisco".
   * @param {SitePreferenceSelectOption[]} [options.selectOptions] - Preference sections to fetch. Defaults to 'scheduling'.
   * @returns {Promise<SitePreferencesResponse>} site preferences response body
   * @throws {ParameterError}
   * @public
   * @memberof MeetingRequest
   */
  fetchSitePreferencesMeViaSite(
    options: FetchSitePreferencesMeViaSiteOptions = {}
  ): Promise<SitePreferencesResponse> {
    const {siteUrl, selectOptions = DEFAULT_SITE_PREFERENCE_SELECT_OPTIONS} = options;

    if (!siteUrl) {
      throw new ParameterError(
        'No siteUrl available. Call register() before fetching site preferences or provide options.siteUrl.'
      );
    }

    // @ts-ignore - config comes from registerPlugin
    const multipartSitePrefixList = this.config.meetings.multipartSitePrefixList || [];
    const siteName = options.siteName || MeetingsUtil.getSiteName(siteUrl, multipartSitePrefixList);

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `https://${siteUrl}/wbxappapi/v1/users/me/preference?select=${encodeURIComponent(
        selectOptions.join(',')
      )}&siteurl=${encodeURIComponent(siteName)}`,
    }).then((res: any) => res.body);
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

// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {HTTP_VERBS, API, RESOURCE} from '../constants';

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
            })
        )
      ).then(() => Promise.resolve(responseBody));
    }

    return Promise.resolve(responseBody);
  }
}

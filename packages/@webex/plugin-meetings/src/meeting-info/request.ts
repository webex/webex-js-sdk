import {API} from '../constants';
import ParameterError from '../common/errors/parameter';

import MeetingInfoUtil from './util';

/**
 * @class MeetingInfoRequest
 */
export default class MeetingInfoRequest {
  webex: any;

  /**
   * Meeting Info Request Constructor
   * @param {WebexSDK} webex
   */
  constructor(webex: any) {
    this.webex = webex;
  }

  /**
   *
   * @param {Object} options with format of {type: String, desintation: String}
   * where type is PERSONAL_ROOM, SIP_URI, CONVERSATION_URL, and destination is userId, sipUri, conversationUrl respectively
   * type can also be specified as an option and be of the list SIP_URI,MEETING_ID,LOCUS_ID,PERSONAL_ROOM,MEETING_LINK,ONE_ON_ONE,MEDIA_SIP_URI,CONVERSATION_URL,TEMP_SIP_URI
   * with the desination matching
   * @returns {Promise} returns a promise that resolves/rejects the result of the request
   * @throws {Error} if the options are not valid and complete
   * @memberof MeetingInfoRequest
   */
  fetchMeetingInfo(options: any) {
    if (!options || !options.type || !options.destination) {
      throw new ParameterError(
        'MeetingInfo should be fetched with a type and destination specified, see list of valid types and their corresponding values in constants'
      );
    }
    const resourceUrl = MeetingInfoUtil.getResourceUrl(options.type, options.destination);
    const requestParams = MeetingInfoUtil.getRequestParams(
      resourceUrl,
      options.type,
      options.destination,
      API.LOCUS
    );

    return this.webex.request(requestParams);
  }
}

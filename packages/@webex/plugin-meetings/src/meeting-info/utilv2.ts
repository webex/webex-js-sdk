import url from 'url';

// @ts-ignore
import {deconstructHydraId} from '@webex/common';

import {
  DESTINATION_TYPE,
  _PEOPLE_,
  _ROOM_,
  DIALER_REGEX,
  WEBEX_DOT_COM,
  CONVERSATION_SERVICE,
  JOIN,
  MEET,
  MEET_M,
  MEET_CISCO,
  MEET_CO,
  HTTPS_PROTOCOL,
  UUID_REG,
  VALID_EMAIL_ADDRESS,
  DEFAULT_MEETING_INFO_REQUEST_BODY,
} from '../constants';
import ParameterError from '../common/errors/parameter';
import LoggerProxy from '../common/logs/logger-proxy';
import {SpaceIDDeprecatedError} from '../common/errors/webex-errors';

/**
 * @class MeetingInfoUtil
 */
export default class MeetingInfoUtil {
  static meetingInfoError =
    'MeetingInfo is fetched with the meeting link, SIP URI, phone number, Hydra people ID, or a conversation URL.';

  static getParsedUrl(link) {
    try {
      let parsedUrl = url.parse(link);

      if (!parsedUrl) {
        return false;
      }
      // hack for links such as <company>.webex.com/meet/<user> without a protocol
      if (!parsedUrl.protocol) {
        parsedUrl = url.parse(`${HTTPS_PROTOCOL}${link}`);
      }

      return parsedUrl;
    } catch (error) {
      LoggerProxy.logger.warn(
        `Meeting-info:util#getParsedUrl --> unable to parse the URL, error: ${error}`
      );

      return null;
    }
  }

  /**
   * Helper function to check if a string matches a known meeting link pattern
   * @param {String} value  string to parse and see if it matches a meeting link
   * @returns {Boolean}
   */
  static isMeetingLink(value: string) {
    let hostNameBool;
    let pathNameBool;
    const parsedUrl = this.getParsedUrl(value);
    if (parsedUrl) {
      hostNameBool = parsedUrl.hostname && parsedUrl.hostname.includes(WEBEX_DOT_COM);
      pathNameBool =
        parsedUrl.pathname &&
        (parsedUrl.pathname.includes(`/${MEET}`) ||
          parsedUrl.pathname.includes(`/${MEET_M}`) ||
          parsedUrl.pathname.includes(`/${MEET_CISCO}`) ||
          parsedUrl.pathname.includes(`/${MEET_CO}`) ||
          parsedUrl.pathname.includes(`/${JOIN}`));
    }

    return hostNameBool && pathNameBool;
  }

  static isConversationUrl(value, webex) {
    const clusterId = webex.internal.services.getClusterId(value);

    if (clusterId) {
      return clusterId.endsWith(CONVERSATION_SERVICE);
    }

    return false;
  }

  static isSipUri(sipString) {
    // TODO: lets remove regex from this equation and user URI matchers and such
    // have not found a great sip uri parser library as of now
    const sipUri = DIALER_REGEX.SIP_ADDRESS.exec(sipString);

    return sipUri;
  }

  static isPhoneNumber(phoneNumber) {
    const isValidNumber = DIALER_REGEX.PHONE_NUMBER.test(phoneNumber);

    return isValidNumber;
  }

  static getHydraId(destination) {
    const {type, id, cluster} = deconstructHydraId(destination);

    if (id && UUID_REG.test(id)) {
      if (type === _ROOM_) {
        return {room: true, destination: id, cluster};
      }
      if (type === _PEOPLE_) {
        return {people: true, destination: id, cluster};
      }

      return {};
    }

    return {};
  }

  static getSipUriFromHydraPersonId(destination, webex) {
    return webex.people
      .get(destination)
      .then((res) => {
        if (res.emails && res.emails.length) {
          return res.emails[0];
        }
        throw new ParameterError('Hydra Id Lookup was an invalid hydra person id.');
      })
      .catch((err) => {
        LoggerProxy.logger.error(
          `Meeting-info:util#MeetingInfoUtil.getSipUriFromHydraPersonId --> getSipUriFromHydraPersonId ${err} `
        );
        throw err;
      });
  }

  static async getDestinationType(from) {
    const {type, webex} = from;
    let {destination} = from;

    if (type === DESTINATION_TYPE.PERSONAL_ROOM) {
      // this case checks if your type is personal room
      if (!destination) {
        // if we are not getting anything in desination we fetch org and user ids from webex instance
        destination = {
          userId: webex.internal.device.userId,
          orgId: webex.internal.device.orgId,
        };
      } else {
        const options = VALID_EMAIL_ADDRESS.test(destination)
          ? {email: destination}
          : {id: destination}; // we are assuming userId as default
        const res = await webex.people.list(options);

        let {orgId, id: userId} = res.items[0];

        userId = deconstructHydraId(userId).id;
        orgId = deconstructHydraId(orgId).id;
        destination = {userId, orgId};
      }
    }
    if (type) {
      return {
        destination,
        type,
      };
    }
    const options: any = {};
    let hydraId;

    if (webex && webex.config && webex.config.meetings && webex.config.meetings.disableHydraId) {
      hydraId = null;
    } else {
      hydraId = this.getHydraId(destination);
    }

    if (this.isMeetingLink(destination)) {
      LoggerProxy.logger.warn(
        'Meeting-info:util#generateOptions --> WARN, use of Meeting Link is deprecated, please use a SIP URI instead'
      );

      options.type = DESTINATION_TYPE.MEETING_LINK;
      options.destination = destination;
    } else if (this.isSipUri(destination)) {
      options.type = DESTINATION_TYPE.SIP_URI;
      options.destination = destination;
    } else if (this.isPhoneNumber(destination)) {
      options.type = DESTINATION_TYPE.SIP_URI;
      options.destination = destination;
    } else if (this.isConversationUrl(destination, webex)) {
      options.type = DESTINATION_TYPE.CONVERSATION_URL;
      options.destination = destination;
    } else if (hydraId && hydraId.people) {
      options.type = DESTINATION_TYPE.SIP_URI;

      return this.getSipUriFromHydraPersonId(hydraId && hydraId.destination, webex).then((res) => {
        options.destination = res;

        // Since hydra person ids require a unique case in which they are
        // entirely converted to a SIP URI, we need to set a flag for detecting
        // this type of destination.
        options.wasHydraPerson = true;

        return Promise.resolve(options);
      });
    } else if (hydraId.room) {
      LoggerProxy.logger.error(
        `Meeting-info:util#getDestinationType --> Using the space ID as a destination is no longer supported. Please refer to the [migration guide](https://github.com/webex/webex-js-sdk/wiki/Migration-to-Unified-Space-Meetings) to migrate to use the meeting ID or SIP address.`
      );
      // Error code 30105 added as Space ID deprecated as of beta, Please refer migration guide.
      throw new SpaceIDDeprecatedError();
    } else {
      LoggerProxy.logger.warn(`Meeting-info:util#getDestinationType --> ${this.meetingInfoError}`);
      throw new ParameterError(`${this.meetingInfoError}`);
    }

    return Promise.resolve(options);
  }

  /**
   * Helper function to build up a correct locus url depending on the value passed
   * @param {Object} options type and value to fetch meeting info
   * @param {DESTINATION_TYPE} options.type One of [SIP_URI, PERSONAL_ROOM, MEETING_ID, CONVERSATION_URL, LOCUS_ID, MEETING_LINK]
   * @param {String} options.installedOrgID org ID of user's machine
   * @param {Object} options.destination ?? value.value
   * @returns {Object} returns an object with {resource, method}
   */
  static getRequestBody(options: {type: DESTINATION_TYPE; destination: object} | any) {
    const {type, destination, password, captchaInfo, installedOrgID, locusId, extraParams} =
      options;
    const body: any = {
      ...DEFAULT_MEETING_INFO_REQUEST_BODY,
      ...extraParams,
    };

    switch (type) {
      case DESTINATION_TYPE.SIP_URI:
        body.sipUrl = destination;
        break;
      case DESTINATION_TYPE.PERSONAL_ROOM:
        body.userId = destination.userId;
        body.orgId = destination.orgId;
        break;
      case DESTINATION_TYPE.MEETING_ID:
        body.meetingKey = destination;
        break;
      case DESTINATION_TYPE.CONVERSATION_URL:
        body.conversationUrl = destination;
        break;
      case DESTINATION_TYPE.LOCUS_ID:
        // use meetingID for the completer meeting info for the already started meeting
        if (destination.info?.webExMeetingId) {
          body.meetingKey = destination.info.webExMeetingId;
        } else if (destination.info?.sipUri) {
          body.sipUrl = destination.info.sipUri;
        }
        break;
      case DESTINATION_TYPE.MEETING_LINK:
        body.meetingUrl = destination;
        break;
      case DESTINATION_TYPE.MEETING_UUID: {
        body.meetingUUID = destination;
        break;
      }
      default:
    }

    if (password) {
      body.password = password;
    }

    if (captchaInfo) {
      body.captchaID = captchaInfo.id;
      body.captchaVerifyCode = captchaInfo.code;
    }

    if (installedOrgID) {
      body.installedOrgID = installedOrgID;
    }

    if (locusId) {
      body.locusId = locusId;
    }

    return body;
  }

  /**
   * Helper function to parse the webex site/host from a URI string.
   * @param {String} uri string (e.g. '10019857020@convergedats.webex.com')
   * @returns {String} the site/host part of the URI string (e.g. 'convergedats.webex.com')
   */
  static getWebexSite(uri: string) {
    const exceptedDomains = ['meet.webex.com', 'meetup.webex.com', 'ciscospark.com'];
    const site = uri?.match(/.+@([^.]+\.[^.]+\.[^.]+)$/)?.[1];
    const isExceptedDomain = !!site && exceptedDomains.some((domain) => site.includes(domain));

    return isExceptedDomain ? null : site;
  }

  /**
   * Helper function to return the direct URI for fetching meeting info (to avoid a redirect).
   * @param {Object} options type and value to fetch meeting info
   * @param {String} options.type One of [SIP_URI, PERSONAL_ROOM, MEETING_ID, CONVERSATION_URL, LOCUS_ID, MEETING_LINK]
   * @param {Object} options.destination ?? value.value
   * @returns {String} returns a URI string or null of there is no direct URI
   */
  static getDirectMeetingInfoURI(options: {type: string; destination: any}) {
    const {type, destination} = options;

    let preferredWebexSite = null;

    switch (type) {
      case DESTINATION_TYPE.SIP_URI:
        preferredWebexSite = this.getWebexSite(destination);
        break;
      case DESTINATION_TYPE.LOCUS_ID:
        preferredWebexSite = destination.info?.webExSite;
        break;
      default:
    }

    return preferredWebexSite ? `https://${preferredWebexSite}/wbxappapi/v1/meetingInfo` : null;
  }
}

import url from 'url';

import btoa from 'btoa';
// @ts-ignore
import {deconstructHydraId} from '@webex/common';

import ParameterError from '../common/errors/parameter';
import LoggerProxy from '../common/logs/logger-proxy';

import {
  DestinationType,
  _PEOPLE_,
  _ROOM_,
  HTTP_VERBS,
  USE_URI_LOOKUP_FALSE,
  TYPE,
  LOCI,
  MEETINGINFO,
  ALTERNATE_REDIRECT_TRUE,
  DIALER_REGEX,
  WEBEX_DOT_COM,
  CONVERSATION_SERVICE,
  WWW_DOT,
  JOIN,
  MEET,
  MEET_M,
  HTTPS_PROTOCOL,
  UUID_REG,
} from '../constants';

/**
 * @class MeetingInfoUtil
 */
export default class MeetingInfoUtil {
  static extractDestination(destination, type) {
    let dest = destination;

    if (type === DestinationType.LOCUS_ID) {
      if (!(destination && destination.url)) {
        throw new ParameterError(
          'You cannot create a meeting by locus without a locus.url defined'
        );
      }
      dest = destination.url;
    }

    return dest;
  }

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
    const parsedUrl = this.getParsedUrl(value);
    let hostNameBool;
    let pathNameBool;
    if (parsedUrl) {
      hostNameBool = parsedUrl.hostname && parsedUrl.hostname.includes(WEBEX_DOT_COM);
      pathNameBool =
        parsedUrl.pathname &&
        (parsedUrl.pathname.includes(`/${MEET}`) ||
          parsedUrl.pathname.includes(`/${MEET_M}`) ||
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

  static convertLinkToSip(value) {
    const parsedUrl = this.getParsedUrl(value);

    if (!parsedUrl) {
      return null;
    }
    let user;

    if (parsedUrl.pathname) {
      const userIndex = parsedUrl.pathname.lastIndexOf('/');

      user = parsedUrl.pathname.substring(userIndex + 1);
    }
    if (!user) {
      return null;
    }
    let company;

    if (parsedUrl.hostname) {
      const companyIndex = parsedUrl.hostname.lastIndexOf(`.${WEBEX_DOT_COM}`);

      company = parsedUrl.hostname.substring(0, companyIndex).replace(WWW_DOT, '');
    }
    if (!company) {
      return null;
    }

    return `${user}@${company}.${WEBEX_DOT_COM}`;
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

  static async generateOptions(from) {
    const {destination, type, webex} = from;

    if (type) {
      return {
        destination,
        type,
      };
    }
    const options: any = {};
    const hydraId = this.getHydraId(destination);

    if (this.isMeetingLink(destination)) {
      LoggerProxy.logger.warn(
        'Meeting-info:util#generateOptions --> WARN, use of Meeting Link is deprecated, please use a SIP URI instead'
      );

      options.type = DestinationType.MEETING_LINK;
      options.destination = destination;
    } else if (this.isSipUri(destination)) {
      options.type = DestinationType.SIP_URI;
      options.destination = destination;
    } else if (this.isPhoneNumber(destination)) {
      options.type = DestinationType.SIP_URI;
      options.destination = destination;
    } else if (this.isConversationUrl(destination, webex)) {
      options.type = DestinationType.CONVERSATION_URL;
      options.destination = destination;
    } else if (hydraId.people) {
      options.type = DestinationType.SIP_URI;

      return this.getSipUriFromHydraPersonId(hydraId.destination, webex).then((res) => {
        options.destination = res;

        // Since hydra person ids require a unique case in which they are
        // entirely converted to a SIP URI, we need to set a flag for detecting
        // this type of destination.
        options.wasHydraPerson = true;

        return Promise.resolve(options);
      });
    } else if (hydraId.room) {
      options.type = DestinationType.CONVERSATION_URL;
      try {
        await webex.internal.services.waitForCatalog('postauth');

        const serviceUrl = webex.internal.services.getServiceUrlFromClusterId(
          {
            cluster: hydraId.cluster,
          },
          webex
        );

        options.destination = hydraId.destination
          ? `${serviceUrl}/conversations/${hydraId.destination}`
          : serviceUrl;
      } catch (e) {
        LoggerProxy.logger.error(`Meeting-info:util#generateOptions --> ${e}`);
        throw e;
      }
    } else {
      throw new ParameterError(
        'MeetingInfo is fetched with the meeting link, SIP URI, phone number, Hydra people ID, or a conversation URL.'
      );
    }

    return Promise.resolve(options);
  }

  /**
   * Helper function to build up a correct locus url depending on the value passed
   * @param {String} type One of [SIP_URI, PERSONAL_ROOM, MEETING_ID, CONVERSATION_URL, LOCUS_ID, MEETING_LINK]
   * @param {Object} value ?? value.value
   * @returns {Object} returns an object with {resource, method}
   */
  static getResourceUrl(type: string, value: any) {
    let resource = `/${LOCI}/${MEETINGINFO}`;
    let method = HTTP_VERBS.GET;
    let uri = null;

    switch (type) {
      case DestinationType.SIP_URI:
      case DestinationType.PERSONAL_ROOM:
      case DestinationType.MEETING_ID:
        resource = `/${LOCI}/${MEETINGINFO}/${encodeURIComponent(
          value
        )}?${TYPE}=${type}&${USE_URI_LOOKUP_FALSE}`;
        break;
      case DestinationType.CONVERSATION_URL:
        method = HTTP_VERBS.PUT;
        break;
      case DestinationType.LOCUS_ID:
        uri = `${value}/${MEETINGINFO}`;
        method = HTTP_VERBS.PUT;
        break;
      case DestinationType.MEETING_LINK:
        resource = `$/${LOCI}/${MEETINGINFO}/${btoa(value)}?${TYPE}=${
          DestinationType.MEETING_LINK
        }&${USE_URI_LOOKUP_FALSE}`;
        break;
      default:
    }

    return {
      uri,
      resource,
      method,
    };
  }

  static getRequestParams(resourceOptions, type, value, api) {
    let requestParams: any = {
      method: resourceOptions.method,
      api,
      resource: resourceOptions.resource,
    };

    if (resourceOptions.method === HTTP_VERBS.GET) {
      // for handling URL redirections
      requestParams.resource = requestParams.resource.concat(`&${ALTERNATE_REDIRECT_TRUE}`);
    } else if (type !== DestinationType.LOCUS_ID) {
      // locus id check is a PUT not sure why
      requestParams.resource = requestParams.resource.concat(`?${ALTERNATE_REDIRECT_TRUE}`);
      requestParams.body = {
        value,
        lookupType: type,
      };
    } else if (type === DestinationType.LOCUS_ID) {
      requestParams = {
        method: resourceOptions.method,
        uri: resourceOptions.uri,
      };
    }

    return requestParams;
  }
}

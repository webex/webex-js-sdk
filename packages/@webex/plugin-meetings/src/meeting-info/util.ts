import url from 'url';

import btoa from 'btoa';
// @ts-ignore
import {deconstructHydraId} from '@webex/common';

import ParameterError from '../common/errors/parameter';
import LoggerProxy from '../common/logs/logger-proxy';

import {
  _SIP_URI_,
  _PERSONAL_ROOM_,
  _MEETING_ID_,
  _CONVERSATION_URL_,
  _LOCUS_ID_,
  _MEETING_LINK_,
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

const MeetingInfoUtil: any = {};

MeetingInfoUtil.extractDestination = (destination, type) => {
  let dest = destination;

  if (type === _LOCUS_ID_) {
    if (!(destination && destination.url)) {
      throw new ParameterError('You cannot create a meeting by locus without a locus.url defined');
    }
    dest = destination.url;
  }

  return dest;
};

MeetingInfoUtil.getParsedUrl = (link) => {
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
};

/**
 * Helper function to check if a string matches a known meeting link pattern
 * @param {String} value  string to parse and see if it matches a meeting link
 * @returns {Boolean}
 */
MeetingInfoUtil.isMeetingLink = (value: string) => {
  const parsedUrl = MeetingInfoUtil.getParsedUrl(value);
  const hostNameBool = parsedUrl.hostname && parsedUrl.hostname.includes(WEBEX_DOT_COM);
  const pathNameBool =
    parsedUrl.pathname &&
    (parsedUrl.pathname.includes(`/${MEET}`) ||
      parsedUrl.pathname.includes(`/${MEET_M}`) ||
      parsedUrl.pathname.includes(`/${JOIN}`));

  return hostNameBool && pathNameBool;
};

MeetingInfoUtil.isConversationUrl = (value, webex) => {
  const clusterId = webex.internal.services.getClusterId(value);

  if (clusterId) {
    return clusterId.endsWith(CONVERSATION_SERVICE);
  }

  return false;
};

MeetingInfoUtil.convertLinkToSip = (value) => {
  const parsedUrl = MeetingInfoUtil.getParsedUrl(value);

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
};

MeetingInfoUtil.isSipUri = (sipString) => {
  // TODO: lets remove regex from this equation and user URI matchers and such
  // have not found a great sip uri parser library as of now
  const sipUri = DIALER_REGEX.SIP_ADDRESS.exec(sipString);

  return sipUri;
};

MeetingInfoUtil.isPhoneNumber = (phoneNumber) => {
  const isValidNumber = DIALER_REGEX.PHONE_NUMBER.test(phoneNumber);

  return isValidNumber;
};

MeetingInfoUtil.getHydraId = (destination) => {
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
};

MeetingInfoUtil.getSipUriFromHydraPersonId = (destination, webex) =>
  webex.people
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

MeetingInfoUtil.generateOptions = async (from) => {
  const {destination, type, webex} = from;

  if (type) {
    return {
      destination,
      type,
    };
  }
  const options: any = {};
  const hydraId = MeetingInfoUtil.getHydraId(destination);

  if (MeetingInfoUtil.isMeetingLink(destination)) {
    LoggerProxy.logger.warn(
      'Meeting-info:util#generateOptions --> WARN, use of Meeting Link is deprecated, please use a SIP URI instead'
    );

    options.type = _MEETING_LINK_;
    options.destination = destination;
  } else if (MeetingInfoUtil.isSipUri(destination)) {
    options.type = _SIP_URI_;
    options.destination = destination;
  } else if (MeetingInfoUtil.isPhoneNumber(destination)) {
    options.type = _SIP_URI_;
    options.destination = destination;
  } else if (MeetingInfoUtil.isConversationUrl(destination, webex)) {
    options.type = _CONVERSATION_URL_;
    options.destination = destination;
  } else if (hydraId.people) {
    options.type = _SIP_URI_;

    return MeetingInfoUtil.getSipUriFromHydraPersonId(hydraId.destination, webex).then((res) => {
      options.destination = res;

      // Since hydra person ids require a unique case in which they are
      // entirely converted to a SIP URI, we need to set a flag for detecting
      // this type of destination.
      options.wasHydraPerson = true;

      return Promise.resolve(options);
    });
  } else if (hydraId.room) {
    options.type = _CONVERSATION_URL_;
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
      'MeetingInfo is fetched with meeting link, sip uri, phone number, hydra room id, hydra people id, or a conversation url.'
    );
  }

  return Promise.resolve(options);
};

/**
 * Helper function to build up a correct locus url depending on the value passed
 * @param {String} type One of [SIP_URI, PERSONAL_ROOM, MEETING_ID, CONVERSATION_URL, LOCUS_ID, MEETING_LINK]
 * @param {Object} value ?? value.value
 * @returns {Object} returns an object with {resource, method}
 */
MeetingInfoUtil.getResourceUrl = (type: string, value: any) => {
  let resource = `/${LOCI}/${MEETINGINFO}`;
  let method = HTTP_VERBS.GET;
  let uri = null;

  switch (type) {
    case _SIP_URI_:
    case _PERSONAL_ROOM_:
    case _MEETING_ID_:
      resource = `/${LOCI}/${MEETINGINFO}/${encodeURIComponent(
        value
      )}?${TYPE}=${type}&${USE_URI_LOOKUP_FALSE}`;
      break;
    case _CONVERSATION_URL_:
      method = HTTP_VERBS.PUT;
      break;
    case _LOCUS_ID_:
      uri = `${value}/${MEETINGINFO}`;
      method = HTTP_VERBS.PUT;
      break;
    case _MEETING_LINK_:
      resource = `$/${LOCI}/${MEETINGINFO}/${btoa(
        value
      )}?${TYPE}=${_MEETING_LINK_}&${USE_URI_LOOKUP_FALSE}`;
      break;
    default:
  }

  return {
    uri,
    resource,
    method,
  };
};

MeetingInfoUtil.getRequestParams = (resourceOptions, type, value, api) => {
  let requestParams: any = {
    method: resourceOptions.method,
    api,
    resource: resourceOptions.resource,
  };

  if (resourceOptions.method === HTTP_VERBS.GET) {
    // for handling URL redirections
    requestParams.resource = requestParams.resource.concat(`&${ALTERNATE_REDIRECT_TRUE}`);
  } else if (type !== _LOCUS_ID_) {
    // locus id check is a PUT not sure why
    requestParams.resource = requestParams.resource.concat(`?${ALTERNATE_REDIRECT_TRUE}`);
    requestParams.body = {
      value,
      lookupType: type,
    };
  } else if (type === _LOCUS_ID_) {
    requestParams = {
      method: resourceOptions.method,
      uri: resourceOptions.uri,
    };
  }

  return requestParams;
};

export default MeetingInfoUtil;

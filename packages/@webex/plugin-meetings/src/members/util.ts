import uuid from 'uuid';
import {
  HTTP_VERBS,
  CONTROLS,
  _FORCED_,
  LEAVE,
  PARTICIPANT,
  VALID_EMAIL_ADDRESS,
  DIALER_REGEX,
  SEND_DTMF_ENDPOINT,
  _REMOVE_,
  ALIAS,
} from '../constants';

import {RoleAssignmentOptions, RoleAssignmentRequest, ServerRoleShape} from './types';

const MembersUtil: any = {};

/**
 * @param {Object} invitee with emailAddress, email or phoneNumber
 * @param {String} locusUrl
 * @param {Boolean} alertIfActive
 * @returns {Object} the format object
 */
MembersUtil.generateAddMemberOptions = (
  invitee: object,
  locusUrl: string,
  alertIfActive: boolean
) => ({
  invitee,
  locusUrl,
  alertIfActive,
});

/**
 * @param {Array} memberIds
 * @param {String} locusUrl
 * @returns {Object} the format object
 */
MembersUtil.generateAdmitMemberOptions = (memberIds: Array<any>, locusUrl: string) => ({
  locusUrl,
  memberIds,
});

/**
 * @param {Object} options with {invitee: {emailAddress, email, phoneNumber}, alertIfActive}
 * @returns {Object} with {invitees: [{address}], alertIfActive}
 */
MembersUtil.getAddMemberBody = (options: any) => ({
  invitees: [
    {
      address: options.invitee.emailAddress || options.invitee.email || options.invitee.phoneNumber,
    },
  ],
  alertIfActive: options.alertIfActive,
});

/**
 * @param {Object} options with {memberIds, authorizingLocusUrl}
 * @returns {Object} admit with {memberIds}
 */
MembersUtil.getAdmitMemberRequestBody = (options: any) => {
  const {memberIds, sessionLocusUrls} = options;
  const body: any = {admit: {participantIds: memberIds}};
  if (sessionLocusUrls) {
    const {authorizingLocusUrl} = sessionLocusUrls;

    return {authorizingLocusUrl, ...body};
  }

  return body;
};

/**
 * @param {Object} format with {memberIds, locusUrl, sessionLocusUrls}
 * @returns {Object} the request parameters (method, uri, body) needed to make a admitMember request
 * if a host/cohost is in a breakout session, the locus url should be the main session locus url
 */
MembersUtil.getAdmitMemberRequestParams = (format: any) => {
  const body = MembersUtil.getAdmitMemberRequestBody(format);
  const {locusUrl, sessionLocusUrls} = format;
  const baseUrl = sessionLocusUrls?.mainLocusUrl || locusUrl;
  const uri = `${baseUrl}/${CONTROLS}`;

  return {
    method: HTTP_VERBS.PUT,
    uri,
    body,
  };
};

/**
 * @param {Object} format with {invitee {emailAddress, email, phoneNumber}, locusUrl, alertIfActive}
 * @returns {Object} the request parameters (method, uri, body) needed to make a addMember request
 */
MembersUtil.getAddMemberRequestParams = (format: any) => {
  const body = MembersUtil.getAddMemberBody(format);
  const requestParams = {
    method: HTTP_VERBS.PUT,
    uri: format.locusUrl,
    body,
  };

  return requestParams;
};

MembersUtil.isInvalidInvitee = (invitee) => {
  if (!(invitee && (invitee.email || invitee.emailAddress || invitee.phoneNumber))) {
    return true;
  }

  if (invitee.phoneNumber) {
    return !DIALER_REGEX.E164_FORMAT.test(invitee.phoneNumber);
  }

  return !VALID_EMAIL_ADDRESS.test(invitee.email || invitee.emailAddress);
};

MembersUtil.getRemoveMemberRequestParams = (options) => {
  const body = {
    reason: options.reason,
  };
  const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${LEAVE}`;

  return {
    method: HTTP_VERBS.PUT,
    uri,
    body,
  };
};

MembersUtil.generateTransferHostMemberOptions = (transfer, moderator, locusUrl) => ({
  moderator,
  locusUrl,
  memberId: transfer,
});

MembersUtil.generateRemoveMemberOptions = (removal, locusUrl) => ({
  reason: _FORCED_,
  memberId: removal,
  locusUrl,
});

MembersUtil.generateMuteMemberOptions = (memberId, status, locusUrl, isAudio) => ({
  memberId,
  muted: status,
  locusUrl,
  isAudio,
});

MembersUtil.generateRaiseHandMemberOptions = (memberId, status, locusUrl) => ({
  memberId,
  raised: status,
  locusUrl,
});

/**
 * @param {String} memberId
 * @param {[ServerRoleShape]} roles
 * @param {String} locusUrl
 * @returns {RoleAssignmentOptions}
 */
MembersUtil.generateRoleAssignmentMemberOptions = (
  memberId: string,
  roles: Array<ServerRoleShape>,
  locusUrl: string
): RoleAssignmentOptions => ({
  memberId,
  roles,
  locusUrl,
});

MembersUtil.generateLowerAllHandsMemberOptions = (requestingParticipantId, locusUrl) => ({
  requestingParticipantId,
  locusUrl,
});

MembersUtil.generateEditDisplayNameMemberOptions = (
  memberId,
  requestingParticipantId,
  alias,
  locusUrl
) => ({
  memberId,
  requestingParticipantId,
  alias,
  locusUrl,
});

MembersUtil.getMuteMemberRequestParams = (options) => {
  const property = options.isAudio === false ? 'video' : 'audio';
  const body = {
    [property]: {
      muted: options.muted,
    },
  };
  const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${CONTROLS}`;

  return {
    method: HTTP_VERBS.PATCH,
    uri,
    body,
  };
};

/**
 * @param {RoleAssignmentOptions} options
 * @returns {RoleAssignmentRequest} the request parameters (method, uri, body) needed to make a addMember request
 */
MembersUtil.getRoleAssignmentMemberRequestParams = (
  options: RoleAssignmentOptions
): RoleAssignmentRequest => {
  const body = {role: {roles: []}};
  options.roles.forEach((role) => {
    body.role.roles.push({type: role.type, hasRole: role.hasRole});
  });

  const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${CONTROLS}`;

  return {
    method: HTTP_VERBS.PATCH,
    uri,
    body,
  };
};

MembersUtil.getRaiseHandMemberRequestParams = (options) => {
  const body = {
    hand: {
      raised: options.raised,
    },
  };
  const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${CONTROLS}`;

  return {
    method: HTTP_VERBS.PATCH,
    uri,
    body,
  };
};

MembersUtil.getLowerAllHandsMemberRequestParams = (options) => {
  const body = {
    hand: {
      raised: false,
    },
    requestingParticipantId: options.requestingParticipantId,
  };
  const uri = `${options.locusUrl}/${CONTROLS}`;

  return {
    method: HTTP_VERBS.PATCH,
    uri,
    body,
  };
};

MembersUtil.editDisplayNameMemberRequestParams = (options) => {
  const body = {
    aliasValue: options.alias,
    requestingParticipantId: options.requestingParticipantId,
  };
  const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${ALIAS}`;

  return {
    method: HTTP_VERBS.POST,
    uri,
    body,
  };
};

MembersUtil.getTransferHostToMemberRequestParams = (options) => {
  const body = {
    role: {
      moderator: options.moderator,
    },
  };
  const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${CONTROLS}`;

  return {
    method: HTTP_VERBS.PATCH,
    uri,
    body,
  };
};

MembersUtil.genderateSendDTMFOptions = (url, tones, memberId, locusUrl) => ({
  url,
  tones,
  memberId,
  locusUrl,
});

MembersUtil.generateSendDTMFRequestParams = ({url, tones, memberId, locusUrl}) => {
  const body = {
    device: {
      url,
    },
    memberId,
    dtmf: {
      correlationId: uuid.v4(),
      tones,
      direction: 'transmit',
    },
  };
  const uri = `${locusUrl}/${PARTICIPANT}/${memberId}/${SEND_DTMF_ENDPOINT}`;

  return {
    method: HTTP_VERBS.POST,
    uri,
    body,
  };
};

MembersUtil.cancelPhoneInviteOptions = (invitee, locusUrl) => ({
  invitee,
  locusUrl,
});

MembersUtil.generateCancelInviteRequestParams = (options) => {
  const body = {
    actionType: _REMOVE_,
    invitees: [
      {
        address: options.invitee.phoneNumber,
      },
    ],
  };
  const requestParams = {
    method: HTTP_VERBS.PUT,
    uri: options.locusUrl,
    body,
  };

  return requestParams;
};

export default MembersUtil;

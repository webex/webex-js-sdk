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
} from '../constants';

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
 * @param {Object} options with {memberIds}
 * @returns {Object} admit with {memberIds}
 */
MembersUtil.getAdmitMemberRequestBody = (options: any) => ({
  admit: {participantIds: options.memberIds},
});

/**
 * @param {Object} format with {memberIds, locusUrl}
 * @returns {Object} the request parameters (method, uri, body) needed to make a admitMember request
 */
MembersUtil.getAdmitMemberRequestParams = (format: any) => {
  const body = MembersUtil.getAdmitMemberRequestBody(format);
  const uri = `${format.locusUrl}/${CONTROLS}`;

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

MembersUtil.generateMuteMemberOptions = (memberId, status, locusUrl) => ({
  memberId,
  muted: status,
  locusUrl,
});

MembersUtil.generateRaiseHandMemberOptions = (memberId, status, locusUrl) => ({
  memberId,
  raised: status,
  locusUrl,
});

MembersUtil.generateLowerAllHandsMemberOptions = (requestingParticipantId, locusUrl) => ({
  requestingParticipantId,
  locusUrl,
});

MembersUtil.getMuteMemberRequestParams = (options) => {
  const body = {
    audio: {
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

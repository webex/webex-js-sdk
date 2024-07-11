import uuid from 'uuid';
import {
  _FORCED_,
  _REMOVE_,
  ALIAS,
  CONTROLS,
  DIALER_REGEX,
  HTTP_VERBS,
  LEAVE,
  PARTICIPANT,
  SEND_DTMF_ENDPOINT,
  VALID_EMAIL_ADDRESS,
} from '../constants';

import {RoleAssignmentOptions, RoleAssignmentRequest, ServerRoleShape} from './types';

const MembersUtil = {
  /**
   * @param {Object} invitee with emailAddress, email or phoneNumber
   * @param {String} locusUrl
   * @param {Boolean} alertIfActive
   * @returns {Object} the format object
   */
  generateAddMemberOptions: (
    invitee: object,
    locusUrl: string,
    alertIfActive: boolean | undefined
  ) => ({
    invitee,
    locusUrl,
    alertIfActive,
  }),

  /**
   * @param {Array} memberIds
   * @param {String} locusUrl
   * @returns {Object} the format object
   */
  generateAdmitMemberOptions: (memberIds: Array<any>, locusUrl: string) => ({
    locusUrl,
    memberIds,
  }),

  /**
   * @param {Object} options with {invitee: {emailAddress, email, phoneNumber}, alertIfActive}
   * @returns {Object} with {invitees: [{address}], alertIfActive}
   */
  getAddMemberBody: (options: any) => ({
    invitees: [
      {
        address:
          options.invitee.emailAddress || options.invitee.email || options.invitee.phoneNumber,
      },
    ],
    alertIfActive: options.alertIfActive,
  }),

  /**
   * @param {Object} options with {memberIds, authorizingLocusUrl}
   * @returns {Object} admit with {memberIds}
   */
  getAdmitMemberRequestBody: (options: any) => {
    const {memberIds, sessionLocusUrls} = options;
    const body: any = {admit: {participantIds: memberIds}};
    if (sessionLocusUrls) {
      const {authorizingLocusUrl} = sessionLocusUrls;

      return {authorizingLocusUrl, ...body};
    }

    return body;
  },

  /**
   * @param {Object} format with {memberIds, locusUrl, sessionLocusUrls}
   * @returns {Object} the request parameters (method, uri, body) needed to make a admitMember request
   * if a host/cohost is in a breakout session, the locus url should be the main session locus url
   */
  getAdmitMemberRequestParams: (format: any) => {
    const body = MembersUtil.getAdmitMemberRequestBody(format);
    const {locusUrl, sessionLocusUrls} = format;
    const baseUrl = sessionLocusUrls?.mainLocusUrl || locusUrl;
    const uri = `${baseUrl}/${CONTROLS}`;

    return {
      method: HTTP_VERBS.PUT,
      uri,
      body,
    };
  },

  /**
   * @param {Object} format with {invitee {emailAddress, email, phoneNumber}, locusUrl, alertIfActive}
   * @returns {Object} the request parameters (method, uri, body) needed to make a addMember request
   */
  getAddMemberRequestParams: (format: any) => {
    const body = MembersUtil.getAddMemberBody(format);
    const requestParams = {
      method: HTTP_VERBS.PUT,
      uri: format.locusUrl,
      body,
    };

    return requestParams;
  },

  isInvalidInvitee: (invitee: Record<string, any>) => {
    if (!(invitee && (invitee.email || invitee.emailAddress || invitee.phoneNumber))) {
      return true;
    }

    if (invitee.phoneNumber) {
      return !DIALER_REGEX.E164_FORMAT.test(invitee.phoneNumber);
    }

    return !VALID_EMAIL_ADDRESS.test(invitee.email || invitee.emailAddress);
  },

  getRemoveMemberRequestParams: (options: Record<string, any>) => {
    const body = {
      reason: options.reason,
    };
    const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${LEAVE}`;

    return {
      method: HTTP_VERBS.PUT,
      uri,
      body,
    };
  },

  generateTransferHostMemberOptions: (transfer: unknown, moderator: unknown, locusUrl: string) => ({
    moderator,
    locusUrl,
    memberId: transfer,
  }),

  generateRemoveMemberOptions: (removal: unknown, locusUrl: string) => ({
    reason: _FORCED_,
    memberId: removal,
    locusUrl,
  }),

  generateMuteMemberOptions: (
    memberId: unknown,
    status: unknown,
    locusUrl: string,
    isAudio: boolean
  ) => ({
    memberId,
    muted: status,
    locusUrl,
    isAudio,
  }),

  generateRaiseHandMemberOptions: (memberId: unknown, status: unknown, locusUrl: string) => ({
    memberId,
    raised: status,
    locusUrl,
  }),

  /**
   * @param {String} memberId
   * @param {[ServerRoleShape]} roles
   * @param {String} locusUrl
   * @returns {RoleAssignmentOptions}
   */
  generateRoleAssignmentMemberOptions: (
    memberId: string,
    roles: Array<ServerRoleShape>,
    locusUrl: string
  ): RoleAssignmentOptions => ({
    memberId,
    roles,
    locusUrl,
  }),

  generateLowerAllHandsMemberOptions: (requestingParticipantId: unknown, locusUrl: string) => ({
    requestingParticipantId,
    locusUrl,
  }),

  /**
   * @param {String} memberId id of the participant who is receiving request
   * @param {String} requestingParticipantId id of the participant who is sending request (optional)
   * @param {String} alias alias name
   * @param {String} locusUrl url
   * @returns {Object} consists of {memberID: string, requestingParticipantId: string, alias: string, locusUrl: string}
   */
  generateEditDisplayNameMemberOptions: (
    memberId: unknown,
    requestingParticipantId: unknown,
    alias: unknown,
    locusUrl: string
  ) => ({
    memberId,
    requestingParticipantId,
    alias,
    locusUrl,
  }),

  getMuteMemberRequestParams: (options: Record<string, any>) => {
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
  },

  /**
   * @param {ServerRoleShape} role
   * @returns {ServerRoleShape} the role shape to be added to the body
   */
  getAddedRoleShape: (role: ServerRoleShape): ServerRoleShape => {
    const roleShape: ServerRoleShape = {type: role.type, hasRole: role.hasRole};

    if (role.hostKey) {
      roleShape.hostKey = role.hostKey;
    }

    return roleShape;
  },

  /**
   * @param {RoleAssignmentOptions} options
   * @returns {RoleAssignmentRequest} the request parameters (method, uri, body) needed to make a addMember request
   */
  getRoleAssignmentMemberRequestParams: (options: RoleAssignmentOptions): RoleAssignmentRequest => {
    const body: {role: {roles: ServerRoleShape[]}} = {role: {roles: []}};
    options.roles.forEach((role) => {
      body.role.roles.push(MembersUtil.getAddedRoleShape(role));
    });

    const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${CONTROLS}`;

    return {
      method: HTTP_VERBS.PATCH,
      uri,
      body,
    };
  },

  getRaiseHandMemberRequestParams: (options: Record<string, any>) => {
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
  },

  getLowerAllHandsMemberRequestParams: (options: Record<string, any>) => {
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
  },

  /**
   * @param {Object} options with format of {locusUrl: string, requestingParticipantId: string}
   * @returns {Object} request parameters (method, uri, body) needed to make a editDisplayName request
   */
  editDisplayNameMemberRequestParams: (options: Record<string, any>) => {
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
  },

  getTransferHostToMemberRequestParams: (options: Record<string, any>) => {
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
  },

  genderateSendDTMFOptions: (
    url: unknown,
    tones: unknown,
    memberId: unknown,
    locusUrl: string
  ) => ({
    url,
    tones,
    memberId,
    locusUrl,
  }),

  generateSendDTMFRequestParams: ({
    url,
    tones,
    memberId,
    locusUrl,
  }: {
    url: unknown;
    tones: unknown;
    memberId: unknown;
    locusUrl: string;
  }) => {
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
  },

  cancelPhoneInviteOptions: (invitee: unknown, locusUrl: unknown) => ({
    invitee,
    locusUrl,
  }),

  generateCancelInviteRequestParams: (options: Record<string, any>) => {
    const body = {
      actionType: _REMOVE_,
      invitees: [
        {
          address: options.invitee.phoneNumber,
        },
      ],
    };

    return {
      method: HTTP_VERBS.PUT,
      uri: options.locusUrl,
      body,
    };
  },
};

export default MembersUtil;

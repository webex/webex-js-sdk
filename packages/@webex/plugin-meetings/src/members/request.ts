// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import {MEETINGS} from '../constants';
import ParameterError from '../common/errors/parameter';

import MembersUtil from './util';
import MeetingUtil from '../meeting/util';
import {RoleAssignmentOptions} from './types';

/**
 * @class MembersRequest
 */
export default class MembersRequest extends StatelessWebexPlugin {
  namespace = MEETINGS;
  locusDeltaRequest: (options: object) => Promise<any>;

  /**
   * Constructor
   * @param {Object} attrs
   * @param {Object} options
   */
  constructor(attrs: {meeting: any}, options: object) {
    const {meeting, ...otherAttrs} = attrs;
    super(otherAttrs, options);

    this.locusDeltaRequest = MeetingUtil.generateLocusDeltaRequest(meeting);
  }

  /**
   *
   * @param {Object} options with format of {invitee: string, locusUrl: string}
   * @returns {Promise}
   * @throws {Error} if the options are not valid and complete, must have invitee with emailAddress OR email AND locusUrl
   * @memberof MembersRequest
   */
  addMembers(options: any) {
    if (
      !(
        !options ||
        !options.invitee ||
        !options.invitee.emailAddress ||
        !options.invitee.email ||
        !options.invitee.phoneNumber ||
        !options.locusUrl
      )
    ) {
      throw new ParameterError(
        'invitee must be passed and the associated locus url for this meeting object must be defined.'
      );
    }
    const requestParams = MembersUtil.getAddMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   *
   * @param {Object} options
   * @returns {Promise}
   * @throws {Error} if the options are not valid and complete, must have memberIds AND locusUrl
   * @memberof MembersRequest
   */
  admitMember(options: any) {
    if (!options || !options.locusUrl || !options.memberIds) {
      throw new ParameterError(
        'memberIds must be an array passed and the associated locus url for this meeting object must be defined.'
      );
    }
    const requestParams = MembersUtil.getAdmitMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to remove a member
   * @param {Record<string, any>} options
   * @param {string} options.locusUrl
   * @param {string} options.memberId ID of member
   * @returns {Promise}
   */
  removeMember(options: Record<string, any>) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getRemoveMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to mute a member
   * @param {Record<string, any>} options
   * @param {string} options.locusUrl
   * @param {string} options.memberId ID of member
   * @returns {Promise}
   */
  muteMember(options: Record<string, any>) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getMuteMemberRequestParams(options);

    // @ts-ignore
    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to the DTMF endpoint to send tones
   * @param {RoleAssignmentOptions} options
   * @param {string} options.locusUrl
   * @param {string} options.memberId ID of PSTN user
   * @returns {Promise}
   */
  assignRolesMember(options: RoleAssignmentOptions) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getRoleAssignmentMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to raise or lower a member's hand
   * @param {Record<string, any>} options
   * @param {string} options.locusUrl
   * @param {string} options.memberId ID of member
   * @returns {Promise}
   */
  raiseOrLowerHandMember(options: Record<string, any>) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getRaiseHandMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to lower all hands
   * @param {Record<string, any>} options
   * @param {string} options.locusUrl
   * @param {string} options.requestingParticipantId ID of requesting participant
   * @returns {Promise}
   */
  lowerAllHandsMember(options: Record<string, any>) {
    if (!options || !options.locusUrl || !options.requestingParticipantId) {
      throw new ParameterError(
        'requestingParticipantId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getLowerAllHandsMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   *
   * @param {Record<string, any>} options with format of {locusUrl: string, requestingParticipantId: string}
   * @returns {Promise}
   * @throws {Error} if the options are not valid and complete, must have requestingParticipantId AND locusUrl
   * @memberof MembersRequest
   */
  editDisplayNameMember(options: {locusUrl: string; requestingParticipantId: string}) {
    if (!options || !options.locusUrl || !options.requestingParticipantId) {
      throw new ParameterError(
        'requestingParticipantId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.editDisplayNameMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to raise or lower a member's hand
   * @param {Record<string, any>} options
   * @param {string} options.locusUrl
   * @param {string} options.memberId ID of member
   * @param {string} options.moderator ID of moderator
   * @returns {Promise}
   */
  transferHostToMember(options: Record<string, any>) {
    if (!options || !options.locusUrl || !options.memberId || !options.moderator) {
      throw new ParameterError(
        'memberId must be defined, the associated locus url, and the moderator for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getTransferHostToMemberRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * Sends a request to the DTMF endpoint to send tones
   * @param {Object} options
   * @param {String} options.locusUrl
   * @param {String} options.url device url SIP user
   * @param {String} options.tones a string of one or more DTMF tones to send
   * @param {String} options.memberId ID of PSTN user
   * @returns {Promise}
   */
  sendDialPadKey(options: {locusUrl: string; url: string; tones: string; memberId: string}) {
    if (
      !options ||
      !options.locusUrl ||
      !options.memberId ||
      !options.url ||
      // @ts-ignore
      (!options.tones && options.tones !== 0)
    ) {
      throw new ParameterError(
        'memberId must be defined, the associated locus url, the device url and DTMF tones for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.generateSendDTMFRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }

  /**
   * @param {Object} options with format of {invitee: string, locusUrl: string}
   * @returns {Promise}
   * @throws {Error} if the options are not valid and complete, must have invitee with emailAddress OR email AND locusUrl
   * @memberof MembersRequest
   */
  cancelPhoneInvite(options: any) {
    if (!(options?.invitee?.phoneNumber || options?.locusUrl)) {
      throw new ParameterError(
        'invitee must be passed and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.generateCancelInviteRequestParams(options);

    return this.locusDeltaRequest(requestParams);
  }
}

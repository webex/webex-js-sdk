// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import {MEETINGS} from '../constants';
import ParameterError from '../common/errors/parameter';

import MembersUtil from './util';

/**
 * @class MembersRequest
 */
export default class MembersRequest extends StatelessWebexPlugin {
  namespace = MEETINGS;

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

    // @ts-ignore
    return this.request(requestParams);
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

    // @ts-ignore
    return this.request(requestParams);
  }

  removeMember(options) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getRemoveMemberRequestParams(options);

    // @ts-ignore
    return this.request(requestParams);
  }

  muteMember(options) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getMuteMemberRequestParams(options);

    // @ts-ignore
    return this.request(requestParams);
  }

  raiseOrLowerHandMember(options) {
    if (!options || !options.locusUrl || !options.memberId) {
      throw new ParameterError(
        'memberId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getRaiseHandMemberRequestParams(options);

    // @ts-ignore
    return this.request(requestParams);
  }

  lowerAllHandsMember(options) {
    if (!options || !options.locusUrl || !options.requestingParticipantId) {
      throw new ParameterError(
        'requestingParticipantId must be defined, and the associated locus url for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getLowerAllHandsMemberRequestParams(options);

    // @ts-ignore
    return this.request(requestParams);
  }

  transferHostToMember(options) {
    if (!options || !options.locusUrl || !options.memberId || !options.moderator) {
      throw new ParameterError(
        'memberId must be defined, the associated locus url, and the moderator for this meeting object must be defined.'
      );
    }

    const requestParams = MembersUtil.getTransferHostToMemberRequestParams(options);

    // @ts-ignore
    return this.request(requestParams);
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
    // @ts-ignore
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

    // @ts-ignore
    return this.request(requestParams);
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

    // @ts-ignore
    return this.request(requestParams);
  }
}

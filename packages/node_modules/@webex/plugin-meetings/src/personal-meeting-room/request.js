import {StatelessWebexPlugin} from '@webex/webex-core';

import {MEETINGS} from '../constants';
import ParameterError from '../common/errors/parameter';

import PersonalMeetingRoomUtil from './util';


/**
 * @class MeetingInfoRequest
 */
export default class PersonalMeetingRoomRequest extends StatelessWebexPlugin {
  namespace = MEETINGS;

  /**
   *
   * @param {Object} options with format of {userId, passcode, meetingAddress, preferred}
   * @returns {Promise} returns a promise that resolves/rejects the result of the request
   * @memberof PersonalMeetingRoomRequest
   */
  claimPmr(options) {
    if (!options || !options.userId || !options.passcode || !options.meetingAddress || !options.preferred) {
      throw new ParameterError('Claiming a PMR should be done with userId, passcode, preferred, and meetingAddress in options.');
    }
    const validPin = PersonalMeetingRoomUtil.getClaimPmrPin(options.passcode);

    if (!validPin) {
      return Promise.reject(new ParameterError('The host pin provided was of an invalid format'));
    }
    const validLink = PersonalMeetingRoomUtil.getClaimPmrLink(options.meetingAddress);

    if (!validLink) {
      return Promise.reject(new ParameterError('The PMR link provided was of an invalid format'));
    }
    const request = PersonalMeetingRoomUtil.getClaimedRequestParams(validLink, validPin, options);

    return this.request(request);
  }
}

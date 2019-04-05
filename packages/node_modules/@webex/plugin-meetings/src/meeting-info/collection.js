import {find} from 'lodash';

import Collection from '../common/collection';
import {MEETINGS} from '../constants';

/**
 * @class MeetingInfoCollection
 */
export default class MeetingInfoCollection extends Collection {
  namespace = MEETINGS;

  /**
   * @memberof MeetingInfoCollection
   * @constructor
   * @public
   */
  constructor() {
    super('meetingInfos');
  }

  /**
   * @param {String} id ID of the meeting info you wish to retreive
   * @returns {MeetingInfo} returns a meeting info instance
   * @public
   * @memberof MeetingInfoCollection
   */
  get(id) {
    if (this.meetingInfos[id]) {
      return this.meetingInfos[id];
    }

    return find(
      this.meetingInfos,
      (info) => info.sipUrl === id || info.locusId === id || info.userId === id || info.meetingLink === id
    );
  }
}

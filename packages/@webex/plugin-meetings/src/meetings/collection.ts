import {find} from 'lodash';

import Collection from '../common/collection';
import {MEETING_KEY} from './meetings.types';
/**
 * @export
 * @class MeetingCollection
 */
export default class MeetingCollection extends Collection {
  /**
   * @constructor
   * @public
   * @memberof MeetingCollection
   */
  constructor() {
    super('meetings');
  }

  set(meeting) {
    // @ts-ignore
    this.meetings[meeting.id] = meeting;

    // @ts-ignore
    return this.meetings[meeting.id];
  }

  /**
   * get a specific meeting searching for key
   * @param {MEETING_KEY} key
   * @param {Any} value
   * @returns {Meeting} if found, else returns null
   * @public
   * @memberof MeetingCollection
   */
  public getByKey(key: MEETING_KEY, value: any) {
    if (key && value) {
      // @ts-ignore
      return find(this.meetings, (meeting) => meeting[key] === value);
    }

    return null;
  }

  /**
   * get a specific meeting searching for key
   * @param {String} breakoutUrl
   * @returns {Meeting} if found, else returns null
   * @public
   * @memberof MeetingCollection
   */
  public getActiveBreakoutLocus(breakoutUrl: string) {
    if (breakoutUrl) {
      // @ts-ignore
      return find(
        // @ts-ignore
        this.meetings,
        (meeting) => meeting.breakouts?.url === breakoutUrl && meeting.breakouts?.isActiveBreakout
      );
    }

    return null;
  }

  /**
   * Gets the meeting that has a webrtc media connection
   * NOTE: this function assumes there is no more than 1 such meeting
   *
   * @returns {Meeting} first meeting found, else undefined
   * @public
   * @memberof MeetingCollection
   */
  public getActiveWebrtcMeeting() {
    // @ts-ignore
    return find(this.meetings, (meeting) => meeting.mediaProperties.webrtcMediaConnection);
  }
}

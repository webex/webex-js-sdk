import {find} from 'lodash';

import Collection from '../common/collection';

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
   * @param {String} key
   * @param {Any} value
   * @returns {Meeting} if found, else returns null
   * @public
   * @memberof MeetingCollection
   */
  public getByKey(key: string, value: any) {
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
   * get a specific meeting searching for key
   * @param {String} breakoutUrl
   * @returns {Meeting} if found, else returns null
   * @public
   * @memberof MeetingCollection
   */
  public getActiveWebrtcMeeting() {
    // @ts-ignore
    return find(this.meetings, (meeting) => meeting.mediaProperties.webrtcMediaConnection);
  }
}

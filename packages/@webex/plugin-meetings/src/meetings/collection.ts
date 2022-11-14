import {find} from 'lodash';

import Collection from '../common/collection';

/**
 * @export
 * @class MeetingCollection
 */
export default class MeetingCollection extends Collection {
  // JSTOTS: VERIFY DECLARED VARIABLES WHETHER ALL OF THEM BELONG HERE OR EXTENDED FROM PARENT CLASS
  // meetings: any;

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
      return find(this.meetings, (meeting) => (meeting[key] === value));
    }

    return null;
  }
}

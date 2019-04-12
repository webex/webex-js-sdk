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
    this.meetings[meeting.id] = meeting;

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
  getByKey(key, value) {
    if (key && value) {
      return find(this.meetings, (meeting) => (meeting[key] === value));
    }

    return null;
  }
}

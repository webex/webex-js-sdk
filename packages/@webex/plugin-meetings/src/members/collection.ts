import {MEETINGS} from '../constants';

/**
 * @class MembersCollection
 */
export default class MembersCollection {
  members: any;
  namespace = MEETINGS;
  /**
   * @param {Object} locus
   * @memberof Members
   */
  constructor() {
    this.members = {};
  }

  set(id, member) {
    this.members[id] = member;
  }

  setAll(members) {
    this.members = members;
  }

  /**
   * @param {String} id
   * @returns {Member}
   */
  get(id: string) {
    return this.members[id];
  }

  /**
   * @returns {Object} returns an object map of Member instances
   * @memberof MembersCollection
   */
  getAll() {
    return this.members;
  }
}

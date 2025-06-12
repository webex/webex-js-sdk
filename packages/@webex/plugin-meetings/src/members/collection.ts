import {MEETINGS} from '../constants';
import Member from '../member';

/**
 * @class MembersCollection
 */
export default class MembersCollection {
  members: Record<string, Member>;
  namespace = MEETINGS;
  /**
   * @param {Object} locus
   * @memberof Members
   */
  constructor() {
    this.members = {};
  }

  set(id: string, member: Member) {
    this.members[id] = member;
  }

  setAll(members: Record<string, Member>) {
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

  /**
   * @returns {void}
   * reset members
   */
  reset() {
    this.members = {};
  }
}

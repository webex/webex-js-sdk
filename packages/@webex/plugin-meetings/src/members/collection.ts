import {MEETINGS} from '../constants';
import Member from '../member';

/**
 * @class MembersCollection
 */
export default class MembersCollection {
  members: Record<string, Member>;
  namespace = MEETINGS;

  // Reverse index: device URL -> owning Member, kept in sync with the collection.
  private memberByDeviceUrl: Map<string, Member>;

  /**
   * @param {Object} locus
   * @memberof Members
   */
  constructor() {
    this.members = {};
    this.memberByDeviceUrl = new Map();
  }

  /**
   * @param {String} id
   * @param {Member} member
   * @returns {void}
   */
  set(id: string, member: Member) {
    const existing = this.members[id];

    if (existing) {
      this.removeFromDeviceUrlIndex(existing);
    }
    this.members[id] = member;
    this.addToDeviceUrlIndex(member);
  }

  /**
   * @param {Object} members
   * @returns {void}
   */
  setAll(members: Record<string, Member>) {
    this.members = members;
    this.rebuildDeviceUrlIndex();
  }

  /**
   * @param {String} id
   * @returns {Member}
   */
  get(id: string) {
    return this.members[id];
  }

  /**
   * @param {String} deviceUrl
   * @returns {Member | undefined} the member that owns the given device URL, if any.
   * @memberof MembersCollection
   */
  getMemberByDeviceUrl(deviceUrl: string): Member | undefined {
    return this.memberByDeviceUrl.get(deviceUrl);
  }

  /**
   * @returns {Object} returns an object map of Member instances
   * @memberof MembersCollection
   */
  getAll() {
    return this.members;
  }

  /**
   * Removes a member from the collection
   * @param {String} id
   * @returns {void}
   */
  remove(id: string) {
    const existing = this.members[id];

    if (existing) {
      this.removeFromDeviceUrlIndex(existing);
      delete this.members[id];
    }
  }

  /**
   * @returns {void}
   * reset members
   */
  reset() {
    this.members = {};
    this.memberByDeviceUrl.clear();
  }

  /**
   * @param {Member} member
   * @returns {void}
   */
  private addToDeviceUrlIndex(member: Member) {
    member.participant?.devices?.forEach((device) => {
      if (device?.url) {
        this.memberByDeviceUrl.set(device.url, member);
      }
    });
  }

  /**
   * @param {Member} member
   * @returns {void}
   */
  private removeFromDeviceUrlIndex(member: Member) {
    member.participant?.devices?.forEach((device) => {
      if (device?.url && this.memberByDeviceUrl.get(device.url) === member) {
        this.memberByDeviceUrl.delete(device.url);
      }
    });
  }

  /**
   * @returns {void}
   */
  private rebuildDeviceUrlIndex() {
    this.memberByDeviceUrl.clear();
    Object.values(this.members).forEach((member) => this.addToDeviceUrlIndex(member));
  }
}

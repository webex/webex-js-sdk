import {isString} from 'lodash';

import ParameterError from './errors/parameter';

/**
 * @class Collection
 */
export default class Collection {
  namespace = 'Meetings';
  propertyName: string;

  /**
   * @param {String} property
   * @memberof Collection
   */
  constructor(property: string) {
    if (!property || !isString(property)) {
      throw new ParameterError('Collection expects a string to use as a property name.');
    }
    /**
     * The property name for what collection will be stored, i.e., this.meetingInfos, this.meetings, etc.
     * @instance
     * @type {String}
     * @public
     * @memberof Meetings
     */
    this.propertyName = property;
    /**
     * The actual object for the collection
     * @instance
     * @type {Object}
     * @public
     * @memberof Meetings
     */
    this[this.propertyName] = {};
  }

  /**
   * @param {String} id ID of the thing stuffed into the collection at id location
   * @returns {Any} returns whatever is being stuffed into the collection
   * @public
   * @memberof Collection
   */
  public get(id: string) {
    return this[this.propertyName] && this[this.propertyName][id]
      ? this[this.propertyName][id]
      : null;
  }

  /**
   * @param {String} id the id of the meeting info instance to add to the collection
   * @param {Any} value the thing to set in the collection
   * @returns {Any} returns the thing just put in the collection
   * @public
   * @memberof Collection
   */
  public set(id: string, value: any) {
    this[this.propertyName][id] = value;

    return this.get(id);
  }

  /**
   * remove the thing at the id
   * @param {String} id ID of the thing you wish to delete from the collection
   * @returns {undefined}
   * @public
   * @memberof Collection
   */
  public delete(id: string) {
    delete this[this.propertyName][id];
  }

  /**
   * @returns {Object} returns an object map of things stuffed into the collection
   * @public
   * @memberof Collection
   */
  public getAll() {
    return this[this.propertyName];
  }

  /**
   * @param {Object} set the replacement object
   * @returns {Object} returns an object map of things stuffed into the collection
   * @public
   * @memberof Collection
   */
  public setAll(set: object) {
    this[this.propertyName] = set;

    return this.getAll();
  }
}

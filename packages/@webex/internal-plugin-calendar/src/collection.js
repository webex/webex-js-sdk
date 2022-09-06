import {find} from 'lodash';

import CalendarUtil from './util';
import {CALENDAR} from './constants';
/**
 * @class CalendarCollection
 */
const CalendarCollection = {
  namespace: CALENDAR,
  items: {},
  /**
   * @param {String} id calendar ID
   * @returns {Any} Calendar Item specifc to that id
   * @private
   * @memberof CalendarCollection
   */
  get(id) {
    return this.items[id];
  },

  /**
   * @param {String} key any key and the corresponding calendar Item
   * @param {String} value any values corresponding to calendar item
   * @returns {Any} returns whatever is being stuffed into the collection
   * @private
   * @memberof CalendarCollection
   */
  getBy(key, value) {
    if (key && value) {
      return find(this.items, (item) => (item[key] === value));
    }

    return null;
  },

  /**
   * @param {Object} item CalendarObject passed to the collection
   * @returns {Any} returns calender id whats get set
   * @private
   * @memberof CalendarCollection
   */
  set(item) {
    const itemId = item.id;
    const meeting = CalendarUtil.calculateEndTime(item);

    this.items[itemId] = meeting;

    return itemId;
  },

  /**
   * resets all the values in the calendarcollection
   * @returns {undefined}
   * @private
   * @memberof CalendarCollection
   */
  reset() {
    this.items = {};
  },


  /**
   * @param {Id} id is the id for the calendar item to be removed
   * @returns {Any} calendar item which got removed
   * @private
   * @memberof CalendarCollection
   */
  remove(id) {
    const meeting = this.get(id);

    delete this.items[id];

    return meeting;
  },

  /**
   * sets all the item passed to the collection
   * @param {Array} items array of calendar items
   * @private
   * @returns {undefined}
   * @memberof CalendarCollection
   */
  setAll(items) {
    items.forEach((item) => {
      this.set(item);
    });
  },

  /**
   * gets all the calendar stored in the collection
   * @param {Array} items array of calendar items
   * @private
   * @returns {Array} returns an array of calendar items
   * @memberof CalendarCollection
   */
  getAll() {
    return Object.values(this.items);
  }

};

export default CalendarCollection;

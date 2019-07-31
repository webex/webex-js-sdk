/**
 * stores the last x filtered stream datas
 */
/**
 * @export
 * @class StatsHistory
 */
export default class StatsHistory {
  /**
   * instantiate our wrapped history array
   * @param {Number} max
   */
  constructor(max) {
    /**
     * @instance
     * @type {Array}
     * @public
     * @memberof StatsHistory
     */
    this.history = [];
    /**
     * @instance
     * @type {Number}
     * @public
     * @memberof StatsHistory
     */
    this.max = max;
  }

  /**
   * @returns {Array} the array of stats reports, read from [0] = most recent to [length - 1] = least recent
   * @public
   * @memberof StatsHistory
   */
  get() {
    return this.history;
  }

  /**
   * deletes the history array and resets it
   * @returns {undefined}
   * @public
   * @memberof StatsHistory
   */
  clear() {
    this.history = [];
  }

  /**
   * gets the stored stat
   * @param {Number} index the location
   * @returns {Object} the stat at location index
   * @public
   * @memberof StatsHistory
   */
  getAt(index) {
    return this.history[index];
  }

  /**
   * gets the most recently stored stat
   * @returns {Object} the most recently added stat to the history recorder
   * @public
   * @memberof StatsHistory
   */
  getMostRecent() {
    return this.history.length > 1 ? this.getAt(0) : null;
  }

  /**
   * gets the last two values, that can be used to compare
   * @returns {Object} {previous: WebRTCData, current: WebRTCData}
   */
  getComparable() {
    return {
      previous: this.getMostRecent(),
      current: this.history.length > 2 ? this.getAt(1) : null
    };
  }

  /**
   * gets a cut of the n most recent WebRTC datas stored
   * @param {Number} exclusiveEnd
   * @returns {Array}
   */
  getSlice(exclusiveEnd) {
    return this.history.slice(0, exclusiveEnd);
  }

  /**
   * adds a history entry into tshe array at the head, removes from the tail
   * if too large, returns the old tail if removed
   * @param {WebRTCData} data filtered stats report to add to the history array
   * @returns {Object} the removed stats report at the end if that had to be removed
   * to make space for the new stats data report to be added to the front
   */
  add(data) {
    let removed = null;

    if (this.history.length >= this.max) {
      removed = this.history.pop();
    }
    this.history.unshift(data);

    return removed;
  }
}

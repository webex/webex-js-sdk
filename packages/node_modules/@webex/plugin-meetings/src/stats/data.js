import uuid from 'uuid';
import {isEmpty, omit} from 'lodash';

import {DEFAULT_OMISSION_DATA_KEYS} from '../constants';

// TODO: Break this up a bit more, so that consumers aren't calling data.data.getData()
/**
 * @class WebRTCData
 */
export default class WebRTCData {
  /**
   * @param {Object} data
   */
  constructor(data) {
    this.data = data;
    this.id = uuid.v4();
  }

  /**
   * get omitted rtc/rtcp/rtp/track/transport/candidate data with omitted data (default)
   * @returns {Object}
   */
  omit() {
    const flat = {};

    Object.keys(this.data).forEach((key) => {
      flat[key] = omit(this.data[key], DEFAULT_OMISSION_DATA_KEYS);
    });

    return flat;
  }

  /**
   * returns if the data is empty
   * @returns {Boolean};
   */
  isEmpty() {
    return isEmpty(this.data);
  }

  /**
   * get the unique id for this specific stat pull
   * @returns {String};
   */
  getId() {
    return this.id;
  }

  /**
   * get the transformed data
   * @returns {Object}
   */
  getData() {
    return this.data;
  }
}

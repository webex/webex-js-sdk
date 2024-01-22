/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import {MEETINGS} from '../constants';

class WebinarCollection {
  webinarInfo: any;

  namespace = MEETINGS;

  mainIndex = 'sessionId';

  constructor() {
    this.webinarInfo = {};
  }

  set(id, info) {
    this.webinarInfo[id] = info;
  }

  /**
   * @param {String} id
   * @returns {Member}
   */
  get(id: string) {
    return this.webinarInfo[id];
  }
}

export default WebinarCollection;

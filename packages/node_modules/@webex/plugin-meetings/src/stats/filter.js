import {Transform} from 'readable-stream';

import StatsTransformer from '../stats/transformer';
import WebRTCData from '../stats/data';

/**
 * Reforms the interesting data from an RTCStatsReport to a new format
 */
export default class StatsFilter extends Transform {
  /**
   * Tells the Stream we're operating in objectMode
   * @private
   */
  constructor() {
    super({objectMode: true});
  }

  /**
   * Filters out data on the RTCStatsReport to the data around call quality and pushes it as a WebRTCData object
   * @param {RTCStatsReport} report
   * @param {*} encoding
   * @param {Function} callback
   * @private
   * @returns {undefined}
   */
  _transform(report, encoding, callback) {
    if (!report) {
      callback();

      return;
    }
    const data = StatsTransformer.transform(report);
    const push = new WebRTCData(data);

    this.push({
      data: push
    });
    callback();
  }
}

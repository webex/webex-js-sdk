import {Transform} from 'stream';

/**
 * Reforms the interesting data from an RTCStatsReport into something grokkable
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
   * Filters out just the interesting part of a RTCStatsReport
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

    const incomingAudio = {
      local: null,
      remote: null
    };
    const incomingVideo = {
      local: null,
      remote: null
    };
    const outgoingAudio = {
      local: null,
      remote: null
    };
    const outgoingVideo = {
      local: null,
      remote: null
    };

    for (const item of report.values()) {
      if (['outbound-rtp', 'outboundrtp'].includes(item.type) && !item.isRemote) {
        if (item.mediaType === 'audio') {
          outgoingAudio.local = item;
          outgoingAudio.remote = report.get(item.remoteId);
        }

        if (item.mediaType === 'video') {
          outgoingVideo.local = item;
          outgoingVideo.remote = report.get(item.remoteId);
        }
      }

      if (['inbound-rtp', 'inboundrtp'].includes(item.type) && !item.isRemote) {
        if (item.mediaType === 'audio') {
          incomingAudio.local = item;
          incomingAudio.remote = report.get(item.remoteId);
        }

        if (item.mediaType === 'video') {
          incomingVideo.local = item;
          incomingVideo.remote = report.get(item.remoteId);
        }
      }
    }

    this.push({
      incomingAudio,
      incomingVideo,
      outgoingAudio,
      outgoingVideo,
      report
    });

    callback();
  }
}

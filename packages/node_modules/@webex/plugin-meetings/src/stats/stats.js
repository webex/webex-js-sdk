import {StatelessWebexPlugin} from '@webex/webex-core';
import {isFunction} from 'lodash';
import {uuid} from 'uuid';

import {
  MEETINGS,
  STATS,
  MQA_STATS
} from '../constants';
import StatsHistory from '../stats/history';
import StatsStream from '../stats/stream';
import StatsFilter from '../stats/filter';
import StatsEvents from '../stats/events';
import StatsError from '../common/errors/stats';

/**
 * @class MeetingStats
 */
export default class MeetingStats extends StatelessWebexPlugin {
  namespace = MEETINGS;

  /**
   * @param {Object} attrs
   * @param {Object} options
   * @param {Object} [optionalCreateOptions]
   * @param {Boolean} optionalCreateOptions.history
   * @param {Boolean} optionalCreateOptions.mqa
   * @param {RTCRtpSender|RTCRtpReceiver} optionalCreateOptions.stream
   * @param {RTCRtpSender|RTCRtpReceiver} optionalCreateOptions.filter
   * @param {RTCPeerConnection} optionalCreateOptions.media
   * @param {String} optionalCreateOptions.id
   * @param {Function} optionalCreateOptions.onClose
   * @param {Function} optionalCreateOptions.onEvent
   * @param {Function} optionalCreateOptions.onData
   * if using filter or stream, media must also exist
   */
  constructor(attrs, options, optionalCreateOptions) {
    super({}, options);
    this.attrs = attrs;
    this.options = options;
    // what this stats object is configured to work with
    /**
     * @instance
     * @type {RTCPeerConnection}
     * @private
     * @memberof MeetingStats
     */
    this.peerConnection = null;
    /**
     * @instance
     * @type {RTCRtpSender|RTCRtpReceiver}
     * @private
     * @memberof MeetingStats
     */
    this.RTCRtpDirection = null;
    // usable values
    /**
     * @instance
     * @type {StatsHistory}
     * @readonly
     * @private
     * @memberof MeetingStats
     */
    this.history = null;
    /**
     * @instance
     * @type {StatsHistory}
     * @readonly
     * @private
     * @memberof MeetingStats
     */
    this.mqa = null;
    /**
     * @instance
     * @type {ReadableStream}
     * @readonly
     * @private
     * @memberof MeetingStats
     */
    this.stream = null;
    /**
     * @instance
     * @type {TransformStream}
     * @readonly
     * @private
     * @memberof MeetingStats
     */
    this.filter = null;
    /**
     * @instance
     * @type {StatsEvents}
     * @readonly
     * @private
     * @memberof MeetingStats
     */
    this.events = null;
    /**
     * @instance
     * @type {String}
     * @readonly
     * @private
     * @memberof MeetingStats
     */
    this.id = null;
    this.populate(optionalCreateOptions);
  }

  /**
   * @param {Object} [optionalCreateOptions]
   * @returns {undefined}
   * @private
   * @memberof MeetingStats
   */
  populate(optionalCreateOptions) {
    if (optionalCreateOptions) {
      if (optionalCreateOptions.history) {
        this.withHistory();
      }
      if (optionalCreateOptions.mqa) {
        this.withMQA();
      }
      if (optionalCreateOptions.filter && !optionalCreateOptions.stream && optionalCreateOptions.media) {
        this.withFilter(optionalCreateOptions.filter, optionalCreateOptions.media);
      }
      if (optionalCreateOptions.stream && !optionalCreateOptions.filter && optionalCreateOptions.media) {
        this.withStream(optionalCreateOptions.stream, optionalCreateOptions.media);
      }
      if (optionalCreateOptions.id) {
        this.withId(optionalCreateOptions.id);
      }
      if (optionalCreateOptions.onClose) {
        if (!isFunction(optionalCreateOptions.onClose)) {
          throw new TypeError('stats->populate#onClose must be a callback function for filtered data.');
        }
        this.onClose(optionalCreateOptions.onClose);
      }
      if (optionalCreateOptions.onEvent) {
        if (!isFunction(optionalCreateOptions.onEvent)) {
          throw new TypeError('stats->populate#onEvent must be a callback function for filtered data.');
        }
        if (this.history) {
          this.withEventsHistory(this.history, optionalCreateOptions.onEvent);
        }
        else {
          this.withEvents(optionalCreateOptions.onEvent);
        }
      }
      if (optionalCreateOptions.onData) {
        if (!isFunction(optionalCreateOptions.onData)) {
          throw new TypeError('stats->populate#onData must be a callback function for filtered data.');
        }
        this.onData(optionalCreateOptions.onData);
      }
    }

    return this;
  }

  /**
   * @param {WebRTCData} data
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  doHistory(data) {
    if (this.history) {
      this.history.add(data);
    }
  }

  /**
   * @param {WebRTCData} data
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  doMQA(data) {
    if (this.mqa && data.data) {
      if (!data.data.isEmpty()) {
        this.mqa.add(data.data.omit());
      }
    }
  }

  /**
   * @param {WebRTCData} data
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  doEvents(data) {
    if (this.events) {
      this.events.event(data);
    }
  }

  /**
   * does all the work for the built properties
   * calls back a function with data from piped stream filter
   * @param {Function} cbFn
   * @returns {undefined}
   * @throws {Error} if the filter stream does not exist
   * @private
   * @memberof MeetingStats
   */
  onData(cbFn) {
    if (!this.filter) {
      throw new TypeError('The stats sender/receiver filter must be set up before data can be processed.');
    }
    this.filter.on(STATS.DATA, (filtered) => {
      this.doHistory(filtered);
      this.doMQA(filtered);
      this.doEvents(filtered);
      cbFn(filtered);
    });

    return this;
  }

  /**
   * triggered if the data stream closes
   * calls back a function with error
   * @param {Function} cbFn
   * @returns {undefined}
   * @private
   * @memberof MeetingStats
   */
  onClose(cbFn) {
    if (!this.filter) {
      throw new TypeError('the stats sender/receiver filter must be set up before data can be closed.');
    }
    this.stream.on(STATS.END, (err) => {
      if (!err) {
        err = new StatsError(`The stats stream for id: ${this.id} ended.`);
      }
      cbFn(err);
    });

    return this;
  }

  /**
   * constructs an event object on this instance
   * @param {StatsHistory} history
   * @param {Function} cb
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withEventsHistory(history, cb) {
    const events = new StatsEvents(history, cb);

    this.setEvents(events);

    return this;
  }

  /**
   * constructs an event object on this instance
   * @param {Function} cb
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withEvents(cb) {
    const events = new StatsEvents(null, cb);

    this.setEvents(events);

    return this;
  }

  /**
   * constructs a history object on this instance
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withHistory() {
    const history = new StatsHistory(this.config.stats.historyMax);

    this.setHistory(history);

    return this;
  }

  /**
   * constructs a history object on this instance
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withMQA() {
    const mqa = new StatsHistory(MQA_STATS.MQA_SIZE);

    this.setMQA(mqa);

    return this;
  }

  /**
   * constructs a readable stream object on this instance
   * @param {RTCRtpReceiver|RTCRtpSender} transceiverDirection
   * @param {RTCPeerConnection} peerConnection
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withStream(transceiverDirection, peerConnection) {
    const stream = new StatsStream({
      rTCRtpDirection: transceiverDirection,
      peerConnection,
      interval: this.config.stats.interval
    });

    this.setStream(stream);

    return this;
  }

  /**
   * @param {RTCRtpReceiver|RTCRtpSender} transceiverDirection
   * @param {RTCPeerConnection} peerConnection
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withFilter(transceiverDirection, peerConnection) {
    this.withStream(transceiverDirection, peerConnection);
    this.setFilter(new StatsFilter());
    this.getStream().pipe(this.getFilter());

    return this;
  }

  /**
   * constructs an id to match this stats object
   * takes params as precedence
   * @param {String} id
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  withId(id) {
    if (id) {
      this.setId(id);
    }
    else {
      this.setId(uuid.v4());
    }

    return this;
  }

  /**
   * @returns {MeetingStats}
   * @public
   * @memberof MeetingStats
   */
  build() {
    return this;
  }

  /**
   * @param {String} id
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  setId(id) {
    this.id = id;
  }

  /**
   * @param {StatsHistory} history
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  setHistory(history) {
    this.history = history;
  }

  /**
   * @param {StatsHistory} mqa
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  setMQA(mqa) {
    this.mqa = mqa;
  }

  /**
   * @param {StatsEvent} events
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  setEvents(events) {
    this.events = events;
  }

  /**
   * @param {Readable} stream
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  setStream(stream) {
    this.stream = stream;
  }

  /**
   * @param {Transform} filter
   * @returns {undefined}
   * @public
   * @memberof MeetingStats
   */
  setFilter(filter) {
    this.filter = filter;
  }

  /**
   * @returns {String}
   * @public
   * @memberof MeetingStats
   */
  getId() {
    return this.id;
  }

  /**
   * @returns {StatsHistory}
   * @public
   * @memberof MeetingStats
   */
  getHistory() {
    return this.history;
  }

  /**
   * @returns {StatsHistory}
   * @public
   * @memberof MeetingStats
   */
  getMQA() {
    return this.mqa;
  }

  /**
   * @returns {StatsEvents}
   * @public
   * @memberof MeetingStats
   */
  getEvents() {
    return this.events;
  }

  /**
   * @returns {Readable}
   * @public
   * @memberof MeetingStats
   */
  getStream() {
    return this.stream;
  }

  /**
   * @returns {Transform}
   * @public
   * @memberof MeetingStats
   */
  getFilter() {
    return this.filter;
  }
}

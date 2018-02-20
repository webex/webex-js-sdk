/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import WebRTCMediaEngine from '@ciscospark/media-engine-webrtc';
import {defaults, get} from 'lodash';

import Call from './call';
import {isCall, shouldRing} from './state-parsers';
import Calls from './calls';

export const events = {
  CALL_CREATED: 'call:created',
  CALL_INCOMING: 'call:incoming'
};

/**
 * Call Created Event
 *
 * Emitted when a call begins outside of the sdk
 *
 * @event call:created
 * @instance
 * @memberof Phone
 * @type {Object}
 * @property {Call} call The created call
 */

/**
 * Incoming Call Event
 *
 * Emitted when a call begins and when {@link Phone#register} is invoked and
 * there are active calls.
 *
 * @event call:incoming
 * @instance
 * @memberof Phone
 * @type {Object}
 * @property {Call} call The incoming call
 */

/**
 * @class
 */
const Phone = SparkPlugin.extend({
  collections: {
    emittedCalls: Calls
  },

  session: {
    /**
     * Indicates whether or not the WebSocket is connected
     * @instance
     * @memberof Phone
     * @member {Boolean}
     * @readonly
     */
    connected: {
      default: false,
      type: 'boolean'
    },
    /**
     * Specifies the facingMode to be used by {@link Phone#dial} and
     * {@link Call#answer} when no constraint is specified. Does not apply if
     * - a {@link MediaStream} is passed to {@link Phone#dial} or
     * {@link Call#answer}
     * - constraints are passed to {@link Phone#dial} or  {@link Call#answer}
     * The only valid values are `user` and `environment`. For any other values,
     * you must provide your own constrains or {@link MediaStream}
     * @default `user`
     * @instance
     * @memberof Phone
     * @type {string}
     */
    defaultFacingMode: {
      default: 'user',
      type: 'string',
      values: ['user', 'environment']
    },
    /**
     * indicates whether or not the client is registered with the Cisco Spark
     * cloud
     * @instance
     * @memberof Phone
     * @member {Boolean}
     * @readonly
     */
    registered: {
      default: false,
      type: 'boolean'
    }
  },

  namespace: 'phone',

  /**
   * Indicates if the current browser appears to support webrtc calling. Note:
   * at this time, there's no way to determine if the current browser supports
   * h264 without asking for camera permissions
   * @instance
   * @memberof Phone
   * @returns {Promise<Boolean>}
   */
  isCallingSupported() {
    return new Promise((resolve) => {
      // I'm not thrilled by this, but detectrtc breaks the global namespace in
      // a way that screws up the browserOnly/nodeOnly test helpers.
      // eslint-disable-next-line global-require
      const DetectRTC = require('detectrtc');
      resolve(DetectRTC.isWebRTCSupported);
    });
  },

  /**
   * Registers the client with the Cisco Spark cloud and starts listening for
   * WebSocket events.
   *
   * Subsequent calls refresh the device registration.
   * @instance
   * @memberof Phone
   * @returns {Promise}
   */
  register() {
    // Ideally, we could call spark.refresh via spark-core, but it doesn't know
    // about the wdm plugin, and all of the leaky abstractions I can think of
    // seem risky.

    return this.spark.internal.device.refresh()
      .then(() => {
        if (this.connected) {
          return Promise.resolve();
        }
        return Promise.all([
          this.emittedCalls.reset(),
          this.spark.internal.mercury.when('event:mercury.buffer_state')
            .then(([message]) => {
              if (message.data.bufferState.locus === 'UNKNOWN') {
                return this.listActiveCalls();
              }
              return Promise.resolve();
            }),
          this.spark.internal.mercury.connect()
        ]);
      });
  },

  /**
   * Disconnects from WebSocket and unregisters from the Cisco Spark cloud.
   *
   * Subsequent calls will be a noop.
   * @instance
   * @memberof Phone
   * @returns {Promise}
   */
  deregister() {
    return this.spark.internal.mercury.disconnect()
      .then(() => this.spark.internal.device.unregister());
  },

  /**
   * Create a MediaStream to be used for video preview.
   *
   * Note: You must explicitly pass the resultant stream to {@link Call#answer()}
   * or {@link Phone#dial()}
   * @instance
   * @memberof Phone
   * @param {Object|MediaStreamConstraints} options
   * @param {MediaStreamConstraints} options.constraints
   * @returns {Promise<MediaStream>}
   */
  createLocalMediaStream(options = {}) {
    const constraints = options.constraints || options;
    defaults(constraints, {
      audio: true,
      video: true
    });

    return WebRTCMediaEngine.getUserMedia(constraints);
  },

  /**
   * Fetches a list of all of the current user's active calls
   * @instance
   * @memberOf Phone
   * @returns {Promise<Call[]>}
   */
  listActiveCalls() {
    return this.spark.internal.locus.list()
      .then((loci) => {
        // emittedCalls is a collection, convert to array
        const calls = this.emittedCalls.map((e) => e);
        if (!loci) {
          return calls;
        }
        loci.forEach((locus) => {
          if (!this.emittedCalls.has(locus)) {
            const callItem = Call.make({locus, parent: this.spark});
            calls.push(callItem);
            this.emittedCalls.add(callItem);
            this._triggerCallEvents(callItem, locus);
          }
        });
        return calls;
      });
  },

  /**
   * Initializer
   * @instance
   * @memberof Phone
   * @param {Object} attrs
   * @param {Object} options
   * @private
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);

    this.listenTo(this.spark.internal.mercury, 'event:locus', (event) => this.onLocusEvent(event));

    // Note: we need to manually wire up change:connected because derived props
    // can't read through this.parent
    this.listenTo(this.spark.internal.mercury, 'change:connected', () => {
      this.connected = this.spark.internal.mercury.connected;
      this.registered = !!this.spark.internal.device.url && this.connected;
    });

    // Note: we need to manually wire up change:url because derived props
    // can't read through this.parent
    this.listenTo(this.spark.internal.device, 'change:url', () => {
      this.registered = !!this.spark.internal.device.url && this.connected;
    });
  },

  /**
   * Determines if the {@link call:incoming} event should be emitted for the
   * specified {@link Types~MercuryEvent}
   * @emits call:incoming
   * @instance
   * @memberof Phone
   * @param {Types~MercuryEvent} event
   * @private
   * @returns {undefined}
   */
  onLocusEvent(event) {
    // We only want to handle calls we are not aware of
    if (this.emittedCalls.has(event.data.locus)) {
      return;
    }

    // Create call object and store in emittedCalls
    const call = Call.make({
      locus: event.data.locus
    }, {
      parent: this.spark
    });
    this.emittedCalls.add(call);

    // Trigger events as necessary
    this._triggerCallEvents(call, event.data.locus);
  },

  /**
   * Place a call to the specified dialString. A dial string may be an email
   * address or sip uri.
   * If you set {@link config.phone.enableExperimentalGroupCallingSupport} to
   * `true`, the dialString may also be a room id.
   * @instance
   * @memberof Phone
   * @param {string} dialString
   * @param {Object} options
   * @param {MediaStreamConstraints} options.constraints
   * @param {MediaStream} options.localMediaStream if no stream is specified, a
   * new one will be created based on options.constraints
   * @returns {Call}
   */
  dial(dialString, options) {
    const call = Call.make({}, {parent: this.spark});

    call.dial(dialString, options);
    this.emittedCalls.add(call);
    return call;
  },

  /**
   * Triggers call events for a given call/locus
   * @param {Call} call
   * @param {Types~Locus} locus
   * @returns {undefined}
   */
  _triggerCallEvents(call, locus) {
    this.trigger(events.CALL_CREATED, call);

    if (shouldRing(locus)) {
      if (isCall(locus) || (!isCall(locus) && get(this, 'config.enableExperimentalGroupCallingSupport'))) {
        this.trigger(events.CALL_INCOMING, call);
      }
    }
  }
});

export default Phone;

/**!
 *
 * Copyright (c) 2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {eventKeys} from '@ciscospark/plugin-locus';
import {defaults} from 'lodash';
import Call from './call';
import {shouldRing} from './state-parsers';
import {getUserMedia} from './webrtc';

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
 * @extends SparkPlugin
 * The calling feature in the SDK is currently available in limited beta. If you'd like to join the beta program and share your feedback, please visit the [developer portal](https://developer.ciscospark.com/sdkaccess/). If you qualify, a Cisco employee will reach out to you.
 */
const Phone = SparkPlugin.extend({
  derived: {
    /**
     * connected Indicates whether or not the WebSocket is connected
     * @instance
     * @memberof Phone
     * @member {Boolean}
     * @readonly
     */
    connected: {
      deps: [`parent.mercury.connected`],
      // FIXME this prop must be cacheable so it can emit change events
      cache: false,
      fn() {
        return Boolean(this.spark.mercury.connected);
      }
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
      deps: [
        `parent.device.url`,
        `connected`
      ],
      // FIXME this prop must be cacheable so it can emit change events
      cache: false,
      fn() {
        return Boolean(this.spark.device.url && this.connected);
      }
    }
  },

  namespace: `phone`,

  /**
   * Indicates if the current browser appears to support webrtc calling. Note:
   * at this time, there's no way to determine if the current browser supports
   * h264 without asking for camera permissions
   * @returns {Promise<Boolean>}
   */
  isCallingSupported() {
    return new Promise((resolve) => {
      // I'm not thrilled by this, but detectrtc breaks the global namespace in
      // a way that screws up the browserOnly/nodeOnly test helpers.
      // eslint-disable-next-line global-require
      const DetectRTC = require(`detectrtc`);
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
    return this.spark.device.refresh()
      .then(() => this.spark.mercury.connect())
      .then(() => this.spark.locus.list())
      .then((loci) => {
        loci.forEach((locus) => {
          this.trigger(`call:incoming`, Call.make({
            locus
          }, {
            parent: this.spark
          }));
        });
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
    // TODO figure out how to hangup all calls (or possibly just disconnect all
    // streams)
    return this.spark.mercury.disconnect()
      .then(() => this.spark.device.unregister());
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
  createLocalMediaStream(options) {
    // TODO need to figure out a way to manage the stream internally. currently,
    // misuse makes it really easy to lock the camera in the on state.
    options = options || {};
    const constraints = options.constraints || options;
    defaults(constraints, {
      audio: true,
      video: true
    });

    return getUserMedia(constraints);
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

    eventKeys.forEach((key) => {
      this.listenTo(this.spark.mercury, `event:${key}`, (event) => this._onLocusEvent(event));
    });
  },

  /**
   * Determines if the {@link call:incoming} event should be emitted for the
   * specifed {@link Types~MercuryEvent}
   * @emits call:incoming
   * @instance
   * @memberof Phone
   * @param {Types~MercuryEvent} event
   * @returns {undefined}
   */
  _onLocusEvent(event) {
    if (shouldRing(event, this.spark)) {
      this.trigger(`call:incoming`, Call.make({
        locus: event.data.locus
      }, {
        parent: this.spark
      }));
    }
  },

  /**
   * Place a call to the specified dialString. A dial string may be an email
   * address or sip uri.
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
    // TODO call register if it has not been called.
    const call = Call.make({}, {parent: this.spark});

    call.dial(dialString, options);
    return call;
  }
});

export default Phone;

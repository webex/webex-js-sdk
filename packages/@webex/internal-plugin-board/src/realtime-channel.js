/** !
 *
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Mercury} from '@webex/internal-plugin-mercury';

/**
 * RealtimeChannel class extending Mercury for handling WebSocket communications in Board plugin
 * Converted from legacy Ampersand.js extend pattern to modern ES6 class
 */
class RealtimeChannel extends Mercury {
  namespace = 'Board';

  /**
   * Create a RealtimeChannel instance
   * @param {Object} options - Configuration options
   * @param {string} options.channelId - Required channel identifier
   * @param {string} [options.socketUrl] - WebSocket URL
   * @param {string} [options.binding] - Channel binding
   */
  constructor(options = {}) {
    super(options);

    // Validate required properties
    if (!options.channelId) {
      throw new Error('channelId is required');
    }

    // Set properties
    this.channelId = options.channelId;
    this.socketUrl = options.socketUrl;
    this.binding = options.binding;

    // Initialize session state
    this.isSharingMercury = false;
    this.socket = null;
  }

  /**
   * Send data through the socket connection
   * @param {any} data - Data to send
   * @returns {Promise} Promise that resolves when data is sent
   */
  send(data) {
    if (!this.socket) {
      throw new Error('Socket is not available');
    }

    return this.socket.send(data);
  }

  /**
   * Connect to the WebSocket
   * @param {string} [socketUrl] - WebSocket URL to connect to
   * @returns {Promise} Promise that resolves when connected
   */
  connect(socketUrl) {
    return super.connect(socketUrl || this.socketUrl);
  }

  /**
   * Disconnect from the WebSocket
   * @param {Object} [options] - Disconnect options
   * @returns {Promise} Promise that resolves when disconnected
   */
  disconnect(options) {
    return super.disconnect(options);
  }

  /**
   * Emit an event (inherits from Mercury's event system)
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   * @returns {void}
   */
  _emit(event, ...args) {
    try {
      this.emit(event, ...args);
    } catch (error) {
      if (this.logger) {
        this.logger.error(`${this.namespace}: error occurred in event handler:`, error);
      }
    }
  }

  /**
   * Set the socket instance
   * @param {Object} socket - Socket instance
   * @returns {void}
   */
  setSocket(socket) {
    this.socket = socket;
  }

  /**
   * Get the current socket instance
   * @returns {Object|null} Current socket instance
   */
  getSocket() {
    return this.socket;
  }

  /**
   * Set Mercury sharing status
   * @param {boolean} sharing - Whether Mercury is being shared
   * @returns {void}
   */
  setMercurySharing(sharing) {
    this.isSharingMercury = Boolean(sharing);
  }

  /**
   * Get Mercury sharing status
   * @returns {boolean} Whether Mercury is being shared
   */
  getMercurySharing() {
    return this.isSharingMercury;
  }

  /**
   * Clean up resources
   * @returns {void}
   */
  destroy() {
    this.socket = null;
    this.isSharingMercury = false;

    // Call parent destroy if it exists
    if (super.destroy) {
      super.destroy();
    }
  }
}

export default RealtimeChannel;

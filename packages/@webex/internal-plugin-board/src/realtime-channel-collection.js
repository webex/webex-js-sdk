/** !
 *
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {WebexCollection as Collection} from '@webex/common';
import RealtimeChannel from './realtime-channel';

/**
 * RealtimeChannelCollection class extending WebexCollection for managing RealtimeChannel instances
 * Converted from legacy Ampersand Collection extend pattern to modern WebexCollection
 */
class RealtimeChannelCollection extends Collection {
  namespace = 'Board';

  /**
   * Create a RealtimeChannelCollection instance
   * @param {Array} [models=[]] - Initial array of models
   * @param {Object} [options={}] - Options including parent reference
   */
  constructor(models = [], options = {}) {
    super(models, options);
    this.mainIndex = 'channelId';
  }

  /**
   * Add a channel to the collection - overrides parent to support both objects and instances
   * @param {Object|RealtimeChannel} channelData - Channel data or instance
   * @returns {RealtimeChannel} The added channel instance
   */
  add(channelData) {
    let channel;

    if (channelData instanceof RealtimeChannel) {
      channel = channelData;
    } else {
      // Create new RealtimeChannel instance from data
      channel = new RealtimeChannel(channelData);
    }

    // Set parent reference if available
    if (this.parent && !channel.parent) {
      channel.parent = this.parent;
    }

    super.add(channel);

    return channel;
  }

  /**
   * Get a channel by its ID - provides Ampersand-compatible API
   * @param {string} channelId - Channel identifier
   * @returns {RealtimeChannel|undefined} The channel instance or undefined if not found
   */
  get(channelId) {
    const models = this.getModels();

    return models.find((channel) => channel.channelId === channelId);
  }

  /**
   * Remove a channel from the collection by ID - provides Ampersand-compatible API
   * @param {string} channelId - Channel identifier
   * @returns {boolean} True if the channel was removed, false if it didn't exist
   */
  remove(channelId) {
    const channel = this.get(channelId);
    if (channel) {
      // Clean up the channel before removing
      if (typeof channel.destroy === 'function') {
        channel.destroy();
      }
      super.remove(channel);

      return true;
    }

    return false;
  }

  /**
   * Check if a channel exists in the collection
   * @param {string} channelId - Channel identifier
   * @returns {boolean} True if the channel exists
   */
  has(channelId) {
    return !!this.get(channelId);
  }

  /**
   * Get all channel IDs
   * @returns {string[]} Array of channel IDs
   */
  keys() {
    const models = this.getModels();

    return models.map((channel) => channel.channelId);
  }

  /**
   * Get all channel instances - alias for getModels for Ampersand compatibility
   * @returns {RealtimeChannel[]} Array of channel instances
   */
  values() {
    return this.getModels();
  }

  /**
   * Iterate over all channels - provides Ampersand-compatible API
   * @param {Function} callback - Function to call for each channel
   * @param {Object} [thisArg] - Value to use as this when executing callback
   * @returns {void}
   */
  forEach(callback, thisArg) {
    const models = this.getModels();
    models.forEach((channel, index) => {
      callback.call(thisArg, channel, index, this);
    });
  }

  /**
   * Clear all channels from the collection
   * @returns {void}
   */
  clear() {
    // Clean up all channels before clearing
    const models = this.getModels();
    models.forEach((channel) => {
      if (typeof channel.destroy === 'function') {
        channel.destroy();
      }
    });
    // Clear the models array
    this.models = [];
    this.emit('change');
  }

  /**
   * Convert collection to array - alias for getModels
   * @returns {RealtimeChannel[]} Array of channel instances
   */
  toArray() {
    return this.getModels();
  }

  /**
   * Find a channel based on a predicate function
   * @param {Function} predicate - Function to test each channel
   * @returns {RealtimeChannel|undefined} The first channel that matches or undefined
   */
  find(predicate) {
    const models = this.getModels();

    return models.find(predicate);
  }

  /**
   * Filter channels based on a predicate function
   * @param {Function} predicate - Function to test each channel
   * @returns {RealtimeChannel[]} Array of channels that match the predicate
   */
  filter(predicate) {
    const models = this.getModels();

    return models.filter(predicate);
  }
}

export default RealtimeChannelCollection;

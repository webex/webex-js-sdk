/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {cloneDeep} from 'lodash';
import '@webex/internal-plugin-lyra';
import '@webex/internal-plugin-search';
import {WebexPlugin} from '@webex/webex-core';
import uuid from 'uuid';

import {LYRA_SPACE, UC_CLOUD, DEFAULT_PRODUCT_NAME} from './constants';
import DeviceCollection from './collection';

const DeviceManager = WebexPlugin.extend({
  namespace: 'DeviceManager',
  _devicePendingPinChallenge: null,
  _pairedDevice: null,
  _boundSpace: null,

  initialize() {
    // Lyra mercury events listener
    this.webex.internal.mercury.on('event:lyra.space_updated', ({data}) => {
      this._receiveDeviceUpdates(data);
    });
  },

  /**
   * Gets a list of all recent devices associated with the user
   * the device list gets populated from Redis
   * @returns {Promise<Device>}
   */
  getAll() {
    return DeviceCollection.getAll();
  },

  /**
   * Gets a list of all recent devices associated with the user
   * the device list gets populated from Redis
   * @returns {Promise<Device>}
   */
  refresh() {
    DeviceCollection.reset();

    return this.webex
      .request({
        api: 'wdm',
        resource: 'devices/auxiliary',
      })
      .then((res) => {
        if (!res.body) {
          return Promise.reject();
        }

        return this._updateDeviceMetadata(res.body.items).then((devices) => {
          /* eslint-disable consistent-return */
          devices.forEach((device) => {
            if (device.deviceInfo && device.deviceInfo.machineType === LYRA_SPACE) {
              return this.webex.internal.lyra.space.get(device.deviceInfo).catch((err) => {
                this.logger.error('DeviceManager#refresh: failed to receive device info', err);
              });
            }
          });
          /* eslint-enable consistent-return */
          res.body.items.forEach((device) => {
            DeviceCollection.set(device);
          });

          return this.getAll();
        });
      })
      .catch((err) => {
        this.logger.error('DeviceManager#refresh: failed to fetch recent devices', err);
      });
  },

  /**
   * Search for a device by name
   * @param {Object} options
   * @param {string} options.searchQuery
   * @returns {Promise<Device>}
   */
  search(options) {
    if (!options || !options.searchQuery) {
      this.logger.error('DeviceManager#search: options.searchQuery is required');

      return Promise.reject(new Error('DeviceManager#search: options.searchQuery is required'));
    }

    return this.webex.internal.search
      .people({
        searchId: uuid.v4(),
        searchType: 'DEVICE_SEARCH',
        searchEntity: 'device',
        includePeople: false,
        includeRooms: true,
        queryString: options.searchQuery,
      })
      .catch((err) => {
        this.logger.error('DeviceManager#search: failed to search a device', err);

        throw err;
      });
  },

  /**
   * Caches the device info and also registers to Redis for subsequent fetches
   * @param {Object} device
   * @param {string} device.id
   * @returns {deviceInfo}
   */
  upsert(device) {
    const deviceId = device.id || (device.identity && device.identity.id);

    if (!deviceId) {
      this.logger.error('DeviceManager#upsert: device.id is required');

      return Promise.reject(new Error('DeviceManager#upsert: device.id is required'));
    }
    this._pairedDevice = this._devicePendingPinChallenge;
    this._devicePendingPinChallenge = null;
    // check if the device is already existing, if so then merge else add
    const existingDevice = DeviceCollection.get(deviceId);

    if (existingDevice) {
      DeviceCollection.set(device);

      return Promise.resolve(DeviceCollection.get(deviceId));
    }

    // new device requested, add to wdm for subsequent retreivals
    return (
      this.webex
        .request({
          api: 'wdm',
          method: 'PUT',
          resource: `devices/auxiliary/Room/${deviceId}`,
        })
        .then((res) => {
          const auxDevice = res.body;

          return this._decryptDeviceName(auxDevice);
        })
        // eslint-disable-next-line no-shadow
        .then((device) => {
          DeviceCollection.set(device);

          return Promise.resolve(DeviceCollection.get(deviceId));
        })
        .catch((err) => {
          this.logger.error('DeviceManager#upsert: failed to add/update a device', err);

          return Promise.reject(err);
        })
    );
  },

  /**
   * Retreives device info of a particular device
   * @param {string} token
   * @returns {Promise<deviceInfo>}
   */
  get(token) {
    if (!token) {
      this.logger.error('DeviceManager#get: token is required');

      return Promise.reject(new Error('DeviceManager#get: token is required'));
    }
    let deviceInfo;

    return this.webex.internal.lyra
      .getAdvertisedEndpoint(token)
      .then((res) => {
        deviceInfo = res;

        return this.webex.internal.lyra.space.get({id: res.advertiser.id});
      })
      .then((result) => {
        // the deviceInfo doesn't have proper displayName, hence update
        // displayName on deviceInfo for search to work
        if (result && result.identity && result.identity.displayName) {
          deviceInfo.advertiser.displayName = result.identity.displayName;
        }

        return deviceInfo;
      })
      .catch((err) => {
        this.logger.error('DeviceManager#get: failed to get device info', err);

        return Promise.reject(err);
      });
  },

  /**
   * Unregisters the device from Redis, will not fetch in subsequent loads,
   * similar to space.deleteBinding()
   * @param {string} deviceId
   * @returns {Promise<deviceInfo>}
   */
  remove(deviceId) {
    if (!deviceId) {
      this.logger.error('DeviceManager#remove: deviceId is required');

      return Promise.reject(new Error('DeviceManager#remove: deviceId is required'));
    }

    return this.webex
      .request({
        method: 'delete',
        api: 'wdm',
        resource: `devices/auxiliary/${deviceId}`,
      })
      .catch((error) => {
        this.logger.error('DeviceManager#remove: failed to remove the device', error);

        return Promise.reject(error);
      });
  },

  /**
   * Requests to display PIN on the device
   * @param {object} device
   * @param {object} options
   * @param {object} options.data
   * @returns {Promise<deviceInfo>}
   */
  requestPin(device, options = {}) {
    const deviceId = device.id || (device.identity && device.identity.id);

    if (!deviceId) {
      this.logger.error('DeviceManager#requestPin: device.id is required');

      return Promise.reject(new Error('DeviceManager#requestPin: device.id is required'));
    }
    const space = {id: deviceId, url: `/spaces/${deviceId}`};

    return this.webex.internal.lyra.space
      .get(space)
      .then((dev) => {
        // check if the space is pinChallenge capable
        if (dev && dev.occupants && dev.occupants.pinChallenge) {
          this.logger.info('DeviceManager#requestPin: space is PIN challenge capable');

          return this.webex.internal.lyra.space
            .join(space, {
              passType: 'MANUAL',
              verificationInitiation: 'PIN',
              data: options.data,
            })
            .then(() => {
              this._devicePendingPinChallenge = dev;

              // return the actual device so that it can be upserted on successful
              // PIN exchange
              return dev;
            });
        }
        // pairs with the space if it's not PIN challenge capable
        this.logger.info(
          'DeviceManager#requestPin: space is not PIN challenge capable, probably already occupied, will still return device info'
        );

        return this.webex.internal.lyra.space.get(space).then(() => Promise.resolve(dev));
      })
      .catch((err) => {
        this.logger.error('DeviceManager#requestPin: device failed PIN challenge request', err);

        return Promise.reject(err);
      });
  },

  /**
   * pairs the device with the user (manual pairing), also adds it to
   * user's recents list for subsequent fetches.
   * similar to space.join()
   * @param {object} options
   * @param {number} options.pin
   * @returns {Promise<deviceInfo>}
   */
  pair(options = {}) {
    if (!options.pin) {
      this.logger.error('DeviceManager#pair: options.pin is required');

      return Promise.reject(new Error('DeviceManager#pair: options.pin is required'));
    }
    if (this._devicePendingPinChallenge) {
      const space = {
        id: this._devicePendingPinChallenge.identity.id,
        url: `/spaces/${this._devicePendingPinChallenge.identity.id}`,
      };

      return this.webex.internal.lyra.space
        .join(space, {
          passType: 'PIN_ANSWER',
          data: options.pin,
        })
        .catch((err) => {
          this.logger.error('DeviceManager#pair: incorrect PIN, unable to pair ', err);

          return Promise.reject(err);
        })
        .then(() => this.upsert(this._devicePendingPinChallenge));
    }
    this.logger.error('DeviceManager#pair: no device to pair');

    return Promise.reject(new Error('DeviceManager#pair: no device to pair'));
  },

  /**
   * unpairs the device with the user (manual/ultrasonic pairing), but still
   * keeps in the recents list/does not remove from Redis
   * options.removeAllDevices will remove all associated devices to user
   * similar to space.leave()
   * @param {object} options
   * @param {boolean} options.removeAllDevices
   * @returns {Promise<deviceInfo>}
   */
  unpair(options = {}) {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#unpair: no device to unpair');

      return Promise.reject(new Error('DeviceManager#unpair: no device to unpair'));
    }
    const space = {url: `/spaces/${this._pairedDevice.identity.id}`};

    return this.webex.internal.lyra.space.leave(space, options).catch((err) => {
      this.logger.error('DeviceManager#unpair: failed to remove device from Lyra', err);

      return Promise.reject(err);
    });
  },

  /**
   * binds the space to the paired device (if supported)
   * similar to space.bindConversation()
   * @param {object} options
   * @param {boolean} options.url, conversation url
   * @param {boolean} options.kmsResourceObjectUrl of the convo
   * @returns {Promise<deviceInfo>}
   */
  bindSpace(options = {}) {
    if (!options.url) {
      this.logger.error('DeviceManager#pair: options.url is required');

      return Promise.reject(new Error('DeviceManager#bindSpace: options.url is required'));
    }
    if (!options.kmsResourceObjectUrl) {
      this.logger.error('DeviceManager#bindSpace: options.kmsResourceObjectUrl is required');

      return Promise.reject(
        new Error('DeviceManager#bindSpace: options.kmsResourceObjectUrl is required')
      );
    }
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#bindSpace: No device paired currently');

      return Promise.reject(new Error('DeviceManager#bindSpace: No device paired currently'));
    }
    const space = {
      url: `/spaces/${this._pairedDevice.identity.id}`,
      id: this._pairedDevice.identity.id,
    };

    this._boundSpace = {
      kmsResourceObjectUrl: options.kmsResourceObjectUrl,
      url: options.url,
    };

    return this.webex.internal.lyra.space.bindConversation(space, this._boundSpace).catch((err) => {
      this.logger.error('DeviceManager#bindSpace: failed to bind device to Space');

      return Promise.reject(err);
    });
  },

  /**
   * unbinds the space to the paired device (if supported)
   * similar to space.unbindConversation()
   * @returns {Promise<deviceInfo>}
   */
  unbindSpace() {
    if (!this._pairedDevice || !this._boundSpace) {
      this.logger.error('DeviceManager#unbindSpace: No space currently bound to the device');

      return Promise.reject(
        new Error('DeviceManager#unbindSpace: No space currently bound to the device')
      );
    }
    const space = {
      url: `/spaces/${this._pairedDevice.identity.id}`,
      id: this._pairedDevice.identity.id,
    };

    return this.webex.internal.lyra.space
      .unbindConversation(space, this._boundSpace)
      .then((res) => {
        this._boundSpace = null;

        return Promise.resolve(res);
      })
      .catch((err) => {
        this.logger.error('DeviceManager#unbindSpace: failed to unbind Space to device');

        return Promise.reject(err);
      });
  },

  /**
   * Gets the audio state of the paired device
   * similar to device.getAudioState()
   * @returns {Promise<audioState>}
   */
  getAudioState() {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#getAudioState: Currently no device is paired');

      return Promise.reject(
        new Error('DeviceManager#getAudioState: Currently no device is paired')
      );
    }

    return this.webex.internal.lyra.device.getAudioState(this._pairedDevice);
  },

  /**
   * Updates audio state of the paired device, should be called every 10 minutes
   * or when mic or volume state is changed
   * similar to device.putAudioState()
   * @param {object} space
   * @param {object} audioState
   * @returns {Promise<audioState>}
   */
  putAudioState(space, audioState = {}) {
    return this.webex.internal.lyra.device.putAudioState(space, audioState);
  },

  /**
   * Mutes paired device
   * similar to device.mute()
   * @returns {Promise<audioState>}
   */
  mute() {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#mute: Currently no device is paired');

      return Promise.reject(new Error('DeviceManager#mute: Currently no device is paired'));
    }

    return this.webex.internal.lyra.device.mute(this._pairedDevice);
  },

  /**
   * Unmutes paired device
   * similar to device.unmute()
   * @returns {Promise<audioState>}
   */
  unmute() {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#unmute: Currently no device is paired');

      return Promise.reject(new Error('DeviceManager#unmute: Currently no device is paired'));
    }

    return this.webex.internal.lyra.device.unmute(this._pairedDevice);
  },

  /**
   * Increases paired device's volume
   * similar to device.increaseVolume()
   * @returns {Promise<audioState>}
   */
  increaseVolume() {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#increaseVolume: Currently no device is paired');

      return Promise.reject(
        new Error('DeviceManager#increaseVolume: Currently no device is paired')
      );
    }

    return this.webex.internal.lyra.device.increaseVolume(this._pairedDevice);
  },

  /**
   * Decreases paired device's volume
   * similar to device.decreaseVolume()
   * @returns {Promise<audioState>}
   */
  decreaseVolume() {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#decreaseVolume: Currently no device is paired');

      return Promise.reject(
        new Error('DeviceManager#decreaseVolume: Currently no device is paired')
      );
    }

    return this.webex.internal.lyra.device.decreaseVolume(this._pairedDevice);
  },

  /**
   * Sets paired device's volume but should use increase and decrease api instead
   * similar to device.setVolume()
   * @param {number} level
   * @returns {Promise<audioState>}
   */
  setVolume(level = 0) {
    if (!this._pairedDevice) {
      this.logger.error('DeviceManager#setVolume: Currently no device is paired');

      return Promise.reject(new Error('DeviceManager#setVolume: Currently no device is paired'));
    }

    return this.webex.internal.lyra.device.setVolume(this._pairedDevice, level);
  },

  /**
   * Utility function to update decrypted device name on device object
   * @param {Array} deviceArray
   * @returns {device}
   */
  _updateDeviceMetadata(deviceArray = []) {
    if (!deviceArray.length) {
      return Promise.resolve(deviceArray);
    }
    const devices = cloneDeep(deviceArray);

    return Promise.all(
      devices.map((device, index) =>
        this.webex.internal.services
          .waitForCatalog('postauth')
          .then(() => {
            if (device.deviceClass === UC_CLOUD) {
              device.id = `${this.webex.internal.services.get('wdm')}/${device.id}`;
            }

            return this._decryptDeviceName(device);
          })
          .then((updatedDevice) => {
            devices[index] = updatedDevice;

            return Promise.resolve();
          })
      )
    ).then(() => Promise.resolve(devices));
  },

  /**
   * Utility function to update decrypted device name on device object
   * @param {object} inDevice
   * @returns {device}
   */
  _decryptDeviceName(inDevice = {}) {
    const device = cloneDeep(inDevice);

    if (
      device.metadata &&
      device.metadata.encryptedUserAssignedName &&
      device.metadata.encryptionKeyUrl
    ) {
      return this.webex.internal.encryption
        .decryptText(device.metadata.encryptionKeyUrl, device.metadata.encryptedUserAssignedName)
        .then((decryptedDeviceName) => {
          // set userAssignedName as the decypted value, unset encryptedUserAssignedName since it's not needed
          device.metadata.encryptedUserAssignedName = undefined;
          device.metadata.userAssignedName = decryptedDeviceName;

          return Promise.resolve(device);
        })
        .catch((err) => {
          // unset encryptedUserAssignedName if failed to decrypt
          device.metadata.encryptedUserAssignedName = undefined;
          this.logger.error(
            'DeviceCollection#_decryptDeviceName: failed to decrypt device name',
            err
          );
        });
    }

    return Promise.resolve(device);
  },

  /**
   * Utility function to update device info on mercury updates
   * @param {object} device
   * @returns {device}
   */
  _receiveDeviceUpdates(device) {
    // we care only the updates are for the registered devices
    if (device && device.spaceUrl) {
      const deviceId = device.spaceUrl.substring(device.spaceUrl.lastIndexOf('/') + 1);
      const existingDevice = DeviceCollection.get(deviceId);

      if (existingDevice) {
        return this.webex.internal.lyra.space
          .get({id: deviceId})
          .then((space) => {
            // eslint-disable-next-line no-shadow
            const device = DeviceCollection.get(deviceId);

            if (
              device &&
              space.occupants &&
              (!space.occupants.self || !space.occupants.self.verified)
            ) {
              device.productName =
                (space.devices && space.devices[0] && space.devices[0].productName) ||
                DEFAULT_PRODUCT_NAME;
              // pin challenge is not verified reset _pairedDevice if ids
              // match
              const pairedDeviceId =
                this._pairedDevice && (this._pairedDevice.id || this._pairedDevice.identity.id);

              if (pairedDeviceId === deviceId) {
                this._pairedDevice = null;
                this.logger.info(
                  `DeviceManager#_receiveDeviceUpdates: device ${deviceId} lost pairing`
                );

                return Promise.resolve();
              }
              // we do not want to reset the device pending PIN challenge
              if (this._devicePendingPinChallenge.identity.id !== deviceId) {
                return this.upsert(device);
              }

              return Promise.resolve();
            }

            return Promise.resolve();
          })
          .catch((err) => {
            this.logger.error(
              'DeviceManager#_receiveDeviceUpdates: failed to receive updates for Lyra space',
              err
            );
          });
      }
    }

    return Promise.resolve();
  },
});

export default DeviceManager;

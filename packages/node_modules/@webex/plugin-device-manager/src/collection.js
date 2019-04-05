import {merge} from 'lodash';

const DeviceCollection = {
  devices: {},

  get(deviceId) {
    return this.devices[deviceId];
  },

  set(device) {
    const deviceId = device.id || device.identity && device.identity.id;
    // check if the device is already existing, if so then merge else add
    const existingDevice = this.devices[deviceId];

    if (existingDevice) {
      // already existing, merge for any new binding information
      merge(existingDevice, device);
    }
    else {
      this.devices[deviceId] = device;
    }
  },

  reset() {
    this.devices = {};
  },

  getAll() {
    return Object.values(this.devices);
  }

};

export default DeviceCollection;

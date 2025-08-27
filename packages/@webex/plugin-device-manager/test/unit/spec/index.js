/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Mercury from '@webex/internal-plugin-mercury';
import WebexCore from '@webex/webex-core';
import DeviceManager from '../../../src/device-manager';
import DeviceCollection from '../../../src/collection';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-device-manager', () => {
  let webex;
  let deviceManager;
  let mockWebex;
  let loggerSpy;
  let deviceCollectionStub;


  beforeEach(() => {
    loggerSpy = {
      info: sinon.spy(),
      error: sinon.spy(),
    };

    mockWebex = {
      internal: {
        mercury: {
          on: sinon.stub(),
        },
      },
      logger: loggerSpy,
    };

    // Create DeviceManager instance
    deviceManager = new DeviceManager({}, {parent: mockWebex});

    // Stub DeviceCollection.get method
    deviceCollectionStub = sinon.stub(DeviceCollection, 'get');

  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getPairedDevice', () => {
    it('returns undefined when no device is paired (null)', () => {
      deviceManager._pairedDevice = null;
      
      const result = deviceManager.getPairedDevice();
      
      assert.isUndefined(result);
      assert.isTrue(deviceManager.logger.info.calledOnce);
      assert.isTrue(deviceManager.logger.info.calledWith(
        'DeviceManager#getPairedDevice: Currently no device is paired'
      ));
    });

    it('returns undefined when no device is paired (undefined)', () => {
      deviceManager._pairedDevice = undefined;
      
      const result = deviceManager.getPairedDevice();
      
      assert.isUndefined(result);
      assert.isTrue(deviceManager.logger.info.calledOnce);
      assert.isTrue(deviceManager.logger.info.calledWith(
        'DeviceManager#getPairedDevice: Currently no device is paired'
      ));
    });

    it('returns the paired device when a device is paired with id property', () => {
      const mockDevice = { id: '123', name: 'Test Device' };
      const retrievedDevice = { id: '123', name: 'Test Device', status: 'connected' };
      deviceManager._pairedDevice = mockDevice;
      DeviceCollection.get.withArgs('123').returns(retrievedDevice);
      
      const result = deviceManager.getPairedDevice();
      
      assert.strictEqual(result, retrievedDevice);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith('123'));
      assert.isFalse(deviceManager.logger.info.called);
    });

    it('returns the paired device when a device is paired with identity.id property', () => {
      const mockDevice = { identity: { id: '456' }, name: 'Test Device' };
      const retrievedDevice = { id: '456', name: 'Test Device', status: 'connected' };
      deviceManager._pairedDevice = mockDevice;
      DeviceCollection.get.withArgs('456').returns(retrievedDevice);
      
      const result = deviceManager.getPairedDevice();
      
      assert.strictEqual(result, retrievedDevice);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith('456'));
      assert.isFalse(deviceManager.logger.info.called);
    });

    it('handles device with both id and identity.id (id takes precedence)', () => {
      const mockDevice = { id: '123', identity: { id: '456' }, name: 'Test Device' };
      const retrievedDevice = { id: '123', name: 'Test Device', status: 'connected' };
      deviceManager._pairedDevice = mockDevice;
      DeviceCollection.get.withArgs('123').returns(retrievedDevice);
      
      const result = deviceManager.getPairedDevice();
      
      assert.strictEqual(result, retrievedDevice);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith('123'));
      // Should not call with '456' since id takes precedence
      assert.isFalse(DeviceCollection.get.calledWith('456'));
    });

    it('returns undefined when DeviceCollection.get returns null', () => {
      const mockDevice = { id: '123', name: 'Test Device' };
      deviceManager._pairedDevice = mockDevice;
      DeviceCollection.get.withArgs('123').returns(null);
      
      const result = deviceManager.getPairedDevice();
      
      assert.isNull(result);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith('123'));
    });

    it('returns undefined when DeviceCollection.get returns undefined', () => {
      const mockDevice = { id: '123', name: 'Test Device' };
      deviceManager._pairedDevice = mockDevice;
      DeviceCollection.get.withArgs('123').returns(undefined);
      
      const result = deviceManager.getPairedDevice();
      
      assert.isUndefined(result);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith('123'));
    });

    it('handles device with empty identity object gracefully', () => {
      const mockDevice = { identity: {}, name: 'Test Device' };
      deviceManager._pairedDevice = mockDevice;
      // Since neither id nor identity.id exist, pairedDeviceId will be undefined
      DeviceCollection.get.withArgs(undefined).returns(undefined);
      
      const result = deviceManager.getPairedDevice();
      
      assert.isUndefined(result);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith(undefined));
    });

    it('handles device with null identity gracefully', () => {
      const mockDevice = { identity: null, name: 'Test Device' };
      deviceManager._pairedDevice = mockDevice;
      // Since neither id nor identity.id exist, pairedDeviceId will be undefined
      DeviceCollection.get.withArgs(undefined).returns(undefined);
      
      const result = deviceManager.getPairedDevice();
      
      assert.isUndefined(result);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith(undefined));
    });

    it('handles complex device object with additional properties', () => {
      const mockDevice = { 
        identity: { id: '789', displayName: 'Conference Room A' },
        name: 'Test Device',
        deviceInfo: { machineType: 'LYRA_SPACE' },
        metadata: { userAssignedName: 'My Device' }
      };
      const retrievedDevice = { 
        id: '789', 
        name: 'Test Device', 
        status: 'connected',
        capabilities: ['audio', 'video']
      };
      deviceManager._pairedDevice = mockDevice;
      DeviceCollection.get.withArgs('789').returns(retrievedDevice);
      
      const result = deviceManager.getPairedDevice();
      
      assert.strictEqual(result, retrievedDevice);
      assert.isTrue(DeviceCollection.get.calledOnce);
      assert.isTrue(DeviceCollection.get.calledWith('789'));
    });
  });

  describe('pairedMethod', () => {
    it('returns the default paired method value "Manual"', () => {
      const result = deviceManager.getPairedMethod();
      
      assert.strictEqual(result, 'Manual');
    });

    it('returns the current paired method value when set', () => {
      deviceManager._pairedMethod = 'Ultrasonic';
      
      const result = deviceManager.getPairedMethod();
      
      assert.strictEqual(result, 'Ultrasonic');
    });

    it('sets the paired method value', () => {
      deviceManager.setPairedMethod('Ultrasonic');
      
      assert.strictEqual(deviceManager._pairedMethod, 'Ultrasonic');
    });

    it('updates the paired method value when called multiple times', () => {
      deviceManager.setPairedMethod('Ultrasonic');
      assert.strictEqual(deviceManager._pairedMethod, 'Ultrasonic');

      deviceManager.setPairedMethod('Manual');
      assert.strictEqual(deviceManager._pairedMethod, 'Manual');

      deviceManager.setPairedMethod('QR');
      assert.strictEqual(deviceManager._pairedMethod, 'QR');
    });
  });
});

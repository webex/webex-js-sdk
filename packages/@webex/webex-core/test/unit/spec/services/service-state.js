import {assert} from '@webex/test-helper-chai';
import {serviceConstants, ServiceState} from '@webex/webex-core';

describe('webex-core', () => {
  describe('ServiceState', () => {
    let serviceState;

    beforeEach('generate service state', () => {
      serviceState = new ServiceState();
    });

    describe('#constructor()', () => {
      it('should create a collection of catalog states', () => {
        assert.isTrue(serviceConstants.SERVICE_CATALOGS.every(
          (catalog) => !!(serviceState[catalog])
        ));
      });

      it('should initialize states with false collecting values', () => {
        assert.isTrue(serviceConstants.SERVICE_CATALOGS.every(
          (catalog) => (serviceState[catalog].collecting === false)
        ));
      });
    });

    describe('#setCollecting()', () => {
      it('should set the collecting value of a catalog state to true', () => {
        serviceState.setCollecting(serviceConstants.SERVICE_CATALOGS[0], true);
        assert.isTrue(
          serviceState[serviceConstants.SERVICE_CATALOGS[0]].collecting
        );
      });

      it('should set the collecting value of a catalog state to false', () => {
        serviceState.setCollecting(serviceConstants.SERVICE_CATALOGS[0], false);
        assert.isFalse(
          serviceState[serviceConstants.SERVICE_CATALOGS[0]].collecting
        );
      });
    });

    describe('#setReady()', () => {
      it('should set the collecting value of a catalog state to true', () => {
        serviceState.setReady(serviceConstants.SERVICE_CATALOGS[0], true);
        assert.isTrue(
          serviceState[serviceConstants.SERVICE_CATALOGS[0]].ready
        );
      });

      it('should set the collecting value of a catalog state to false', () => {
        serviceState.setReady(serviceConstants.SERVICE_CATALOGS[0], false);
        assert.isFalse(
          serviceState[serviceConstants.SERVICE_CATALOGS[0]].ready
        );
      });
    });

    describe('static methods', () => {
      describe('#generateCatalogState()', () => {
        it('returns an object with the correct keys', () => {
          assert.containsAllKeys(
            ServiceState.generateCatalogState(),
            ['collecting', 'ready']
          );
        });
      });
    });
  });
});

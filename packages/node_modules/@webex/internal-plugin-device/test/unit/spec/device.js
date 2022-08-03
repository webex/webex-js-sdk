import {assert} from '@webex/test-helper-chai';
import {cloneDeep} from 'lodash';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

import Device from '@webex/internal-plugin-device';

import dto from './wdm-dto';

describe('plugin-device', () => {
  describe('Device', () => {
    let webex;
    let device;

    beforeEach('initialize webex with the device plugin', () => {
      webex = new MockWebex({
        children: {
          device: Device
        }
      });

      const clonedDTO = cloneDeep(dto);

      webex.internal.device.set(clonedDTO);

      device = webex.internal.device;
    });

    describe('events', () => {
      describe('when a feature is changed', () => {
        let spy;
        let modifiedDTOFeatures;

        beforeEach('setup sinon', () => {
          spy = sinon.spy();
          modifiedDTOFeatures = {
            ...dto.features,
            user: [
              ...dto.features.user,
              ...dto.features.developer
            ]
          };
        });

        it('should trigger a \'change\' event', () => {
          device.on('change', spy);
          device.features.set(modifiedDTOFeatures);
          assert.called(spy);
        });

        it('should trigger a \'change:features\' event', () => {
          device.on('change:features', spy);
          device.features.set(modifiedDTOFeatures);
          assert.called(spy);
        });
      });

      describe('when an network inactivity property changes', () => {
        beforeEach('setup sinon', () => {
          device.checkNetworkReachability = sinon.spy();
        });

        describe('when the \'intranetInactivityCheckUrl\' changes', () => {
          beforeEach('change \'intranetInactivityCheckUrl\'', () => {
            device.intranetInactivityCheckUrl = 'https://not-a-url.com';
          });

          it('should call \'checkNetworkReachability()\'', () => {
            assert.called(device.checkNetworkReachability);
          });

          it('should set isReachabilityChecked to true', () => {
            assert.isTrue(device.isReachabilityChecked);
          });
        });

        describe('when the \'intranetInactivityDuration\' changes', () => {
          beforeEach('change \'intranetInactivityDuration\'', () => {
            device.intranetInactivityDuration = 1234;
          });

          it('should call \'checkNetworkReachability()\'', () => {
            assert.called(device.checkNetworkReachability);
          });

          it('should set isReachabilityChecked to true', () => {
            assert.isTrue(device.isReachabilityChecked);
          });
        });

        describe('when the \'inNetworkInactivityDuration\' changes', () => {
          beforeEach('change \'inNetworkInactivityDuration\'', () => {
            device.inNetworkInactivityDuration = 1234;
          });

          it('should call \'checkNetworkReachability()\'', () => {
            assert.called(device.checkNetworkReachability);
            assert.isTrue(device.isReachabilityChecked);
          });
        });
      });
    });

    describe('derived properties', () => {
      describe('#registered', () => {
        describe('when the device does not have a url', () => {
          beforeEach('remove the device\'s url', () => {
            device.url = undefined;
          });

          it('should return false', () => {
            assert.isFalse(device.registered);
          });
        });

        describe('when the device does have a url', () => {
          beforeEach('set the device\'s url', () => {
            device.url = dto.url;
          });

          it('should return true', () => {
            assert.isTrue(device.registered);
          });
        });
      });
    });

    describe('#setLogoutTimer()', () => {
      describe('when the duration parameter is not set', () => {
        it('should not change the existing timer', () => {
          const {logoutTimer} = device;

          device.setLogoutTimer();
          assert.equal(device.logoutTimer, logoutTimer);
        });
      });

      describe('when the duration parameter is zero or negative', () => {
        it('should not change the existing timer', () => {
          const {logoutTimer} = device;

          device.setLogoutTimer(-1);
          assert.equal(device.logoutTimer, logoutTimer);
        });
      });

      describe('when the duration is valid', () => {
        beforeEach(() => {
          device.resetLogoutTimer = sinon.spy();
        });

        it('should create a \'change:lastUserActivityDate\' listener', () => {
          device.setLogoutTimer(60000);
          device.trigger('change:lastUserActivityDate');
          assert.called(device.resetLogoutTimer);
        });

        it('should set the logout timer', () => {
          const {logoutTimer} = device;

          device.setLogoutTimer(60000);
          assert.notEqual(device.logoutTimer, logoutTimer);
        });
      });
    });

    describe('#serialize()', () => {
      it('should serialize entitlement feature keys', () => {
        assert.hasAllKeys(
          device.serialize().features.entitlement,
          Object.keys(dto.features.entitlement)
        );
      });

      it('should serialize user feature keys', () => {
        assert.hasAllKeys(
          device.serialize().features.user,
          Object.keys(dto.features.user)
        );
      });
    });

    describe('#refresh()', () => {
      let requestSpy;

      const setup = () => {
        sinon.stub(device, 'canRegister').callsFake(() => Promise.resolve());
        sinon.stub(device, 'processRegistrationSuccess').callsFake(() => {});
        requestSpy = sinon.spy(device, 'request');
        device.config.defaults = {};
        device.set('registered', true);
      };

      it('If-None-Match header is added if etag is set', async () => {
        setup();

        device.set('etag', 'etag-value');

        const result = device.refresh();

        await result;

        assert.deepEqual(requestSpy.args[0][0].headers, {
          'If-None-Match': 'etag-value'
        });
      });

      it('If-None-Match header is not added if etag is not set', async () => {
        setup();

        const result = device.refresh();

        await result;

        assert.deepEqual(requestSpy.args[0][0].headers, {});
      });
    });

    describe('#processRegistrationSuccess()', () => {
      const getClonedDTO = (overrides) => {
        const clonedDTO = cloneDeep(dto);

        clonedDTO.features = {
          developer: [
            {
              key: '1',
              type: 'boolean',
              val: 'true',
              value: true,
              mutable: true,
              lastModified: '2015-06-29T20:02:48.033Z'
            },
          ],
          entitlement: [
            {
              key: '2',
              val: 'true',
              value: true,
              mutable: false
            }
          ],
          user: [
            {
              key: '3',
              val: 'true',
              value: true,
              mutable: true
            }
          ],
          ...overrides
        };

        return clonedDTO;
      };

      const checkFeatureNotPresent = (type, key) => {
        assert.isUndefined(device.features[type].get(key));
      };

      const checkFeature = (type, key, expectedValue) => {
        assert.equal(device.features[type].length, 1);
        assert.deepEqual(device.features[type].get(key).get('value'), expectedValue);
      };

      it('features are set correctly if etag not in headers', () => {
        const clonedDTO = getClonedDTO();

        const response = {
          body: {
            ...clonedDTO
          },
          headers: {

          }
        };

        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeature('developer', '1', true);
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);
      });

      it('if the etag matches only the user and entitlement features are updated', () => {
        const clonedDTO = getClonedDTO();

        device.set('etag', 'etag-value');

        const response = {
          body: {
            ...clonedDTO
          },
          headers: {
            etag: 'etag-value'
          }
        };

        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureNotPresent('developer', '1');
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);

        // confirm that the etag is unchanged
        assert.equal(device.get('etag'), 'etag-value');
      });

      it('if the etag matches only the user and entitlement features are updated - check when developer features are set', () => {
        const clonedDTO = getClonedDTO();

        device.set('etag', 'etag-value');

        const response = {
          body: {
            ...clonedDTO
          },
          headers: {
            etag: 'etag-value'
          }
        };

        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeatureNotPresent('developer', '1');
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);

        // confirm that the etag is unchanged
        assert.equal(device.get('etag'), 'etag-value');
      });

      it('if the etag does not match all the features are updated', () => {
        const clonedDTO = getClonedDTO();

        device.set('etag', 'etag-value');

        const response = {
          body: {
            ...clonedDTO
          },
          headers: {
            etag: 'different-etag-value'
          }
        };

        checkFeatureNotPresent('developer', '1');
        checkFeatureNotPresent('entitlement', '2');
        checkFeatureNotPresent('user', '3');

        device.processRegistrationSuccess(response);

        checkFeature('developer', '1', true);
        checkFeature('entitlement', '2', true);
        checkFeature('user', '3', true);

        // confirm that the new etag is set
        assert.equal(device.get('etag'), 'different-etag-value');

        const newClonedDTO = getClonedDTO({
          developer: [
            {
              key: '1',
              type: 'boolean',
              val: 'false',
              value: false,
              mutable: true,
              lastModified: '2015-06-29T20:02:48.033Z'
            },
          ],
          entitlement: [
            {
              key: '2',
              val: 'false',
              value: false,
              mutable: false
            }
          ],
          user: [
            {
              key: '3',
              val: 'false',
              value: false,
              mutable: true
            }
          ],
        });


        const newResponse = {
          body: {
            ...newClonedDTO
          },
          headers: {
            etag: 'different-etag-value'
          }
        };

        device.processRegistrationSuccess(newResponse);

        // only the entitlement and user features should have been changed to false
        checkFeature('developer', '1', true);
        checkFeature('entitlement', '2', false);
        checkFeature('user', '3', false);
      });
    });
  });
});

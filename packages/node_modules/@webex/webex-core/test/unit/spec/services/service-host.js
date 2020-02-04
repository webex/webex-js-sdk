import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {ServiceHost} from '@webex/webex-core';

describe('webex-core', () => {
  describe('ServiceHost', () => {
    let defaultHostGroup;
    let fixture;
    let serviceHost;

    before('generate fixture', () => {
      fixture = {
        catalog: 'discovery',
        defaultUri: 'https://example-default.com/',
        hostGroup: 'example-host-group.com',
        id: 'example-head:example-group:example-cluster:example-name',
        priority: 1,
        uri: 'example-uri.com'
      };

      defaultHostGroup = 'example-default.com';
    });

    describe('#constructor()', () => {
      it('should attempt to validate services', () => {
        sinon.spy(ServiceHost, 'validate');

        serviceHost = new ServiceHost(fixture);

        assert.called(ServiceHost.validate);
      });
    });

    describe('class members', () => {
      beforeEach('generate service host', () => {
        serviceHost = new ServiceHost(fixture);
      });

      describe('#active', () => {
        it('should return false when the host has failed', () => {
          serviceHost.failed = true;
          assert.isFalse(serviceHost.active);
        });

        it('should return false when the host has been replaced', () => {
          serviceHost.replaced = true;
          assert.isFalse(serviceHost.active);
        });

        it('should return true when the host is active', () => {
          serviceHost.replaced = false;
          serviceHost.replaced = false;
          assert.isTrue(serviceHost.active);
        });
      });

      describe('#catalog', () => {
        it('should match the parameter value', () => {
          assert.equal(serviceHost.catalog, fixture.catalog);
        });
      });

      describe('#defaultUri', () => {
        it('should match the parameter value', () => {
          assert.equal(serviceHost.default, fixture.defaultUri);
        });
      });

      describe('#failed', () => {
        it('should automatically set the value to false', () => {
          assert.isFalse(serviceHost.failed);
        });
      });

      describe('#hostGroup', () => {
        it('should match the parameter value', () => {
          assert.equal(serviceHost.hostGroup, fixture.hostGroup);
        });
      });

      describe('#id', () => {
        it('should match the parameter value', () => {
          assert.equal(serviceHost.id, fixture.id);
        });
      });

      describe('#local', () => {
        it('should return true when the uri includes the host group', () => {
          serviceHost.hostGroup = defaultHostGroup;
          assert.isTrue(serviceHost.local);
        });

        it('should return true when the uri excludes the host group', () => {
          serviceHost.hostGroup = fixture.hostGroup;
          assert.isFalse(serviceHost.local);
        });
      });

      describe('#priority', () => {
        it('should match the parameter value', () => {
          assert.equal(serviceHost.priority, fixture.priority);
        });
      });

      describe('#replaced', () => {
        it('should automatically set the value to false', () => {
          assert.isFalse(serviceHost.replaced);
        });
      });

      describe('#service', () => {
        it('should return the service', () => {
          assert.equal(serviceHost.service, fixture.id.split(':')[3]);
        });
      });

      describe('#uri', () => {
        it('should match the parameter value', () => {
          assert.equal(serviceHost.uri, fixture.uri);
        });
      });

      describe('#url', () => {
        it('should return a host-mapped url', () => {
          assert.isTrue(serviceHost.url.includes(serviceHost.uri));
        });
      });
    });

    describe('#setStatus()', () => {
      it('should set the property failed to true', () => {
        assert.isTrue(serviceHost.setStatus({failed: true}).failed);
      });


      it('should set the property failed to false', () => {
        assert.isFalse(serviceHost.setStatus({failed: false}).failed);
      });

      it('should set the property replaced to true', () => {
        assert.isTrue(serviceHost.setStatus({replaced: true}).replaced);
      });


      it('should set the property replaced to false', () => {
        assert.isFalse(serviceHost.setStatus({replaced: false}).replaced);
      });

      it('should set the property replaced and failed to true', () => {
        assert.isTrue(serviceHost.setStatus({
          failed: true,
          replaced: true
        }).failed);

        assert.isTrue(serviceHost.setStatus({
          failed: true,
          replaced: true
        }).replaced);
      });

      it('should set the property replaced and failed to false', () => {
        assert.isFalse(serviceHost.setStatus({
          failed: false,
          replaced: false
        }).failed);

        assert.isFalse(serviceHost.setStatus({
          failed: false,
          replaced: false
        }).replaced);
      });

      describe('static methods', () => {
        describe('#polyGenerate()', () => {
          let polyFixture;

          beforeEach('set the poly fixture', () => {
            polyFixture = {
              catalog: fixture.catalog,
              name: fixture.id.split(':')[3],
              url: fixture.defaultUri
            };
          });

          it('should generate a new ServiceHost', () => {
            assert.instanceOf(
              ServiceHost.polyGenerate(polyFixture),
              ServiceHost
            );
          });
        });

        describe('#validate()', () => {
          it('should throw an error when catalog is missing', () => {
            delete fixture.catalog;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when defaultUri is missing', () => {
            delete fixture.defaultUri;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when hostGroup is missing', () => {
            delete fixture.hostGroup;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when id is missing', () => {
            delete fixture.id;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when priority is missing', () => {
            delete fixture.priority;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when uri is missing', () => {
            delete fixture.uri;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when catalog is invalid', () => {
            fixture.catalog = 1234;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when defaultUri is invalid', () => {
            fixture.defaultUri = 1234;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when hostGroup is invalid', () => {
            fixture.hostGroup = 1234;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when id is invalid', () => {
            fixture.id = 1234;
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when priority is invalid', () => {
            fixture.priority = 'test-string';
            assert.throws(() => ServiceHost.validate(fixture));
          });

          it('should throw an error when uri is invalid', () => {
            fixture.uri = 1234;
            assert.throws(() => ServiceHost.validate(fixture));
          });
        });
      });
    });
  });
});

/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {assert, expect} from '@webex/test-helper-chai';
import DSS from '@webex/internal-plugin-dss';
import {Batcher} from '@webex/webex-core';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {set} from 'lodash';
import uuid from 'uuid';
import config from '@webex/internal-plugin-dss/src/config';

chai.use(chaiAsPromised);
describe('plugin-dss', () => {
  describe('DSS', () => {
    const originalBatcherRequest = Batcher.prototype.request;
    let webex;
    let uuidStub;
    let mercuryCallbacks;
    let clock;

    beforeEach(() => {
      webex = MockWebex({
        canAuthorize: false,
        children: {
          dss: DSS,
        },
      });
      webex.config.dss = config.dss;

      uuidStub = sinon.stub(uuid, 'v4').returns('randomid');

      webex.canAuthorize = true;
      webex.internal.device.orgId = 'userOrgId';

      mercuryCallbacks = {};

      webex.internal.mercury = {
        connect: sinon.stub().returns(Promise.resolve()),
        disconnect: sinon.stub().returns(Promise.resolve()),
        on: sinon.stub().callsFake((event, callback) => {
          mercuryCallbacks[event] = callback;
        }),
        off: sinon.spy(),
      };

      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      uuidStub.restore();
      clock.restore();
      Batcher.prototype.request = originalBatcherRequest;
    });

    describe('#register()', () => {
      it('registers correctly', async () => {
        await webex.internal.dss.register();

        assert.callCount(webex.internal.mercury.on, 2);

        const firstCallArgs = webex.internal.mercury.on.getCall(0).args;

        expect(firstCallArgs[0]).to.equal('event:directory.lookup');
        expect(firstCallArgs[1]).to.be.a('function');

        const secondCallArgs = webex.internal.mercury.on.getCall(1).args;

        expect(secondCallArgs[0]).to.equal('event:directory.search');
        expect(secondCallArgs[1]).to.be.a('function');

        assert.equal(webex.internal.dss.registered, true);
      });

      it('rejects when it cannot authorize', async () => {
        webex.canAuthorize = false;
        // @ts-ignore
        await expect(webex.internal.dss.register()).to.be.rejectedWith(
          Error,
          'SDK cannot authorize'
        );
        assert.equal(webex.internal.dss.registered, false);
      });
    });

    describe('#unregister()', () => {
      it('unregisters correctly', async () => {
        webex.internal.dss.registered = true;
        await webex.internal.dss.unregister();

        assert.callCount(webex.internal.mercury.off, 2);

        const firstCallArgs = webex.internal.mercury.off.getCall(0).args;

        expect(firstCallArgs[0]).to.equal('event:directory.lookup');

        const secondCallArgs = webex.internal.mercury.off.getCall(1).args;

        expect(secondCallArgs[0]).to.equal('event:directory.search');

        assert.equal(webex.internal.dss.registered, false);
      });

      it('handles unregister when it is not registered', async () => {
        const result = await webex.internal.dss.unregister();

        await expect(result).equal(undefined);
        assert.equal(webex.internal.dss.registered, false);
      });
    });

    const createData = (requestId, sequence, finished, dataPath, results) => {
      const data = {
        requestId,
        sequence,
      };

      if (finished) {
        (data as any).finished = finished;
      }
      set(data, dataPath, results);

      return {data};
    };

    const testMakeRequest = async ({method, resource, params, bodyParams}) => {
      webex.request = sinon.stub();

      await webex.internal.dss.register();

      const promise = webex.internal.dss[method](params);

      const requestId = 'randomid';

      expect(webex.request.getCall(0).args).to.deep.equal([
        {
          service: 'directorySearch',
          body: {
            requestId,
            ...bodyParams,
          },
          contentType: 'application/json',
          method: 'POST',
          resource,
        },
      ]);

      return {requestId, promise};
    };

    const testMakeBatchedRequests = async ({requests, calls}) => {
      requests.forEach((request, index) => {
        uuidStub.onCall(index).returns(request.id);
      });
      webex.request = sinon.stub();

      await webex.internal.dss.register();

      const promises = calls.map((call) => webex.internal.dss[call.method](call.params));

      await clock.tickAsync(49);
      expect(webex.request.notCalled).to.be.true;
      await clock.tickAsync(1);
      expect(webex.request.called).to.be.true;

      requests.forEach((request, index) => {
        expect(webex.request.getCall(index).args).to.deep.equal([
          {
            service: 'directorySearch',
            body: {
              requestId: request.id,
              ...request.bodyParams,
            },
            contentType: 'application/json',
            method: 'POST',
            resource: request.resource,
          },
        ]);
      });

      return {promises};
    };

    describe('#lookupDetail', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            foundArray: ['test id'],
          })
        );

        const result = await webex.internal.dss.lookupDetail({id: 'test id'});

        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            foundPath: 'lookupResult.entitiesFound',
            resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookupDetail',
          resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          params: {id: 'test id'},
          bodyParams: {},
        });

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {
            entities: ['data0'],
            entitiesFound: ['test id'],
          })
        );
        const result = await promise;

        expect(result).to.deep.equal('data0');
      });

      it('fails correctly if lookup fails', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookupDetail',
          resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          params: {id: 'test id'},
          bodyParams: {},
        });

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {entitiesNotFound: ['test id']})
        );
        const result = await promise;

        expect(result).to.be.null;
      });
      it('fails with default timeout when mercury does not respond', async () => {
        const {promise} = await testMakeRequest({
          method: 'lookupDetail',
          resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          params: {id: 'test id'},
          bodyParams: {},
        });

        promise.catch(() => {}); // to prevent the test from failing due to unhandled promise rejection

        await clock.tickAsync(6000);

        return assert.isRejected(
          promise,
          'The DSS did not respond within 6000 ms.' +
            '\n Request Id: randomid' +
            '\n Resource: /lookup/orgid/userOrgId/identity/test id/detail' +
            '\n Params: undefined'
        );
      });

      it('does not fail with timeout when mercury response in time', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookupDetail',
          resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          params: {id: 'test id'},
          bodyParams: {},
        });

        await clock.tickAsync(499);

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {entitiesNotFound: ['test id']})
        );

        return assert.isFulfilled(promise);
      });
    });

    describe('#lookup', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            foundArray: ['id1'],
          })
        );

        const result = await webex.internal.dss.lookup({id: 'id1', shouldBatch: false});

        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            foundPath: 'lookupResult.entitiesFound',
            resource: '/lookup/orgid/userOrgId/identities',
            params: {
              lookupValues: ['id1'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('calls _request correctly with entityProviderType', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            foundArray: ['id1'],
          })
        );

        const result = await webex.internal.dss.lookup({
          id: 'id1',
          entityProviderType: 'CI_USER',
          shouldBatch: false,
        });

        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            foundPath: 'lookupResult.entitiesFound',
            resource: '/lookup/orgid/userOrgId/entityprovidertype/CI_USER',
            params: {
              lookupValues: ['id1'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookup',
          resource: '/lookup/orgid/userOrgId/identities',
          params: {id: 'id1', shouldBatch: false},
          bodyParams: {lookupValues: ['id1']},
        });

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {
            entities: ['data0'],
            entitiesFound: ['id1'],
          })
        );
        const result = await promise;

        expect(result).to.deep.equal('data0');
      });

      it('fails correctly if lookup fails', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookup',
          resource: '/lookup/orgid/userOrgId/identities',
          params: {id: 'id1', shouldBatch: false},
          bodyParams: {lookupValues: ['id1']},
        });

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {entitiesNotFound: ['id1']})
        );
        const result = await promise;

        expect(result).to.be.null;
      });

      it('calls _batchedLookup correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._batchedLookup = sinon
          .stub()
          .returns(Promise.resolve('some return value'));

        const result = await webex.internal.dss.lookup({id: 'id1'});

        expect(webex.internal.dss._batchedLookup.getCall(0).args).to.deep.equal([
          {
            resource: '/lookup/orgid/userOrgId/identities',
            lookupValue: 'id1',
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('calls _batchedLookup correctly with entityProviderType', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._batchedLookup = sinon
          .stub()
          .returns(Promise.resolve('some return value'));

        const result = await webex.internal.dss.lookup({
          id: 'id1',
          entityProviderType: 'CI_USER',
        });

        expect(webex.internal.dss._batchedLookup.getCall(0).args).to.deep.equal([
          {
            resource: '/lookup/orgid/userOrgId/entityprovidertype/CI_USER',
            lookupValue: 'id1',
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('Single batched lookup is made after 50 ms and works', async () => {
        const {promises} = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid1',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id1']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', shouldBatch: true},
            },
          ],
        });

        mercuryCallbacks['event:directory.lookup'](
          createData('randomid1', 0, true, 'lookupResult', {
            entities: ['data0'],
            entitiesFound: ['id1'],
          })
        );
        const result = await promises[0];

        expect(result).to.deep.equal('data0');
      });

      it('Single batched lookup fails correctly if lookup fails', async () => {
        const {promises} = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid1',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id1']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', shouldBatch: true},
            },
          ],
        });

        mercuryCallbacks['event:directory.lookup'](
          createData('randomid1', 0, true, 'lookupResult', {entitiesNotFound: ['id1']})
        );

        const result = await promises[0];

        expect(result).to.be.null;
      });

      it('Batch of 2 lookups is made after 50 ms and works', async () => {
        const {promises} = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid1',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id1', 'id2']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', shouldBatch: true},
            },
            {
              method: 'lookup',
              params: {id: 'id2', shouldBatch: true},
            },
          ],
        });

        mercuryCallbacks['event:directory.lookup'](
          createData('randomid1', 0, true, 'lookupResult', {
            entities: ['data1', 'data2'],
            entitiesFound: ['id1', 'id2'],
          })
        );
        const result1 = await promises[0];

        expect(result1).to.equal('data1');
        const result2 = await promises[1];

        expect(result2).to.equal('data2');
      });

      it('Batch of 2 lookups is made after 50 ms and one fails correctly', async () => {
        const {promises} = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid1',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id1', 'id2']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', shouldBatch: true},
            },
            {
              method: 'lookup',
              params: {id: 'id2', shouldBatch: true},
            },
          ],
        });

        mercuryCallbacks['event:directory.lookup'](
          createData('randomid1', 0, true, 'lookupResult', {
            entities: ['data2'],
            entitiesFound: ['id2'],
            entitiesNotFound: ['id1'],
          })
        );
        const result1 = await promises[0];

        expect(result1).to.be.null;

        const result2 = await promises[1];

        expect(result2).to.equal('data2');
      });

      it('Two unrelated lookups are made after 50 ms and work', async () => {
        const {promises} = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid1',
              resource: '/lookup/orgid/userOrgId/entityprovidertype/CI_USER',
              bodyParams: {lookupValues: ['id1']},
            },
            {
              id: 'randomid2',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id2']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', entityProviderType: 'CI_USER', shouldBatch: true},
            },
            {
              method: 'lookup',
              params: {id: 'id2', shouldBatch: true},
            },
          ],
        });

        mercuryCallbacks['event:directory.lookup'](
          createData('randomid1', 0, true, 'lookupResult', {
            entities: ['data1'],
            entitiesFound: ['id1'],
          })
        );
        mercuryCallbacks['event:directory.lookup'](
          createData('randomid2', 0, true, 'lookupResult', {
            entities: ['data2'],
            entitiesFound: ['id2'],
          })
        );
        const result1 = await promises[0];

        expect(result1).to.equal('data1');
        const result2 = await promises[1];

        expect(result2).to.equal('data2');
      });

      it('Two unrelated lookups are made after 50 ms and one fails correctly', async () => {
        const {promises} = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid1',
              resource: '/lookup/orgid/userOrgId/entityprovidertype/CI_USER',
              bodyParams: {lookupValues: ['id1']},
            },
            {
              id: 'randomid2',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id2']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', entityProviderType: 'CI_USER', shouldBatch: true},
            },
            {
              method: 'lookup',
              params: {id: 'id2', shouldBatch: true},
            },
          ],
        });

        mercuryCallbacks['event:directory.lookup'](
          createData('randomid1', 0, true, 'lookupResult', {entitiesNotFound: ['id1']})
        );
        mercuryCallbacks['event:directory.lookup'](
          createData('randomid2', 0, true, 'lookupResult', {
            entities: ['data2'],
            entitiesFound: ['id2'],
          })
        );
        const result1 = await promises[0];

        expect(result1).to.be.null;
        const result2 = await promises[1];

        expect(result2).to.equal('data2');
      });

      it('fails with default timeout when mercury does not respond', async () => {
        const {promise} = await testMakeRequest({
          method: 'lookup',
          resource: '/lookup/orgid/userOrgId/identities',
          params: {id: 'id1', shouldBatch: false},
          bodyParams: {lookupValues: ['id1']},
        });

        promise.catch(() => {}); // to prevent the test from failing due to unhandled promise rejection

        await clock.tickAsync(6000);

        return assert.isRejected(
          promise,
          'The DSS did not respond within 6000 ms.' +
            '\n Request Id: randomid' +
            '\n Resource: /lookup/orgid/userOrgId/identities' +
            '\n Params: {"lookupValues":["id1"]}'
        );
      });

      it('does not fail with timeout when mercury response in time', async () => {
        const {promise, requestId} = await testMakeRequest({
          method: 'lookup',
          resource: '/lookup/orgid/userOrgId/identities',
          params: {id: 'id1', shouldBatch: false},
          bodyParams: {lookupValues: ['id1']},
        });

        await clock.tickAsync(499);

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {entitiesNotFound: ['test id']})
        );

        return assert.isFulfilled(promise);
      });
    });

    describe('#lookupByEmail', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            foundArray: ['email1'],
          })
        );

        const result = await webex.internal.dss.lookupByEmail({
          email: 'email1',
        });

        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            foundPath: 'lookupResult.entitiesFound',
            resource: '/lookup/orgid/userOrgId/emails',
            params: {
              lookupValues: ['email1'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookupByEmail',
          resource: '/lookup/orgid/userOrgId/emails',
          params: {email: 'email1'},
          bodyParams: {lookupValues: ['email1']},
        });

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {
            entities: ['data0'],
            entitiesFound: ['email1'],
          })
        );
        const result = await promise;

        expect(result).to.deep.equal('data0');
      });

      it('fails correctly if lookup fails', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookupByEmail',
          resource: '/lookup/orgid/userOrgId/emails',
          params: {email: 'email1'},
          bodyParams: {lookupValues: ['email1']},
        });

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {}) // entitiesNotFound isn't returned for email
        );
        const result = await promise;

        expect(result).to.be.null;
      });

      it('fails with default timeout when mercury does not respond', async () => {
        const {promise} = await testMakeRequest({
          method: 'lookupByEmail',
          resource: '/lookup/orgid/userOrgId/emails',
          params: {email: 'email1'},
          bodyParams: {lookupValues: ['email1']},
        });

        promise.catch(() => {}); // to prevent the test from failing due to unhandled promise rejection

        await clock.tickAsync(6000);

        return assert.isRejected(
          promise,
          'The DSS did not respond within 6000 ms.' +
            '\n Request Id: randomid' +
            '\n Resource: /lookup/orgid/userOrgId/emails' +
            '\n Params: {"lookupValues":["email1"]}'
        );
      });

      it('does not fail with timeout when mercury response in time', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'lookupByEmail',
          resource: '/lookup/orgid/userOrgId/emails',
          params: {email: 'email1'},
          bodyParams: {lookupValues: ['email1']},
        });

        await clock.tickAsync(5999);

        mercuryCallbacks['event:directory.lookup'](
          createData(requestId, 0, true, 'lookupResult', {}) // entitiesNotFound isn't returned for email
        );

        return assert.isFulfilled(promise);
      });
    });

    describe('#search', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon
          .stub()
          .returns(Promise.resolve({resultArray: 'some return value'}));

        const result = await webex.internal.dss.search({
          requestedTypes: ['PERSON', 'ROBOT'],
          resultSize: 100,
          queryString: 'query',
        });

        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'directoryEntities',
            resource: '/search/orgid/userOrgId/entities',
            params: {
              queryString: 'query',
              resultSize: 100,
              requestedTypes: ['PERSON', 'ROBOT'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'search',
          resource: '/search/orgid/userOrgId/entities',
          params: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
          bodyParams: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
        });

        mercuryCallbacks['event:directory.search'](
          createData(requestId, 1, false, 'directoryEntities', ['data1'])
        );
        mercuryCallbacks['event:directory.search'](
          createData(requestId, 2, true, 'directoryEntities', ['data2'])
        );
        mercuryCallbacks['event:directory.search'](
          createData(requestId, 0, false, 'directoryEntities', ['data0'])
        );
        const result = await promise;

        expect(result).to.deep.equal(['data0', 'data1', 'data2']);
      });

      it('fails with default timeout when mercury does not respond', async () => {
        const {promise} = await testMakeRequest({
          method: 'search',
          resource: '/search/orgid/userOrgId/entities',
          params: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
          bodyParams: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
        });

        promise.catch(() => {}); // to prevent the test from failing due to unhandled promise rejection

        await clock.tickAsync(6000);

        return assert.isRejected(
          promise,
          'The DSS did not respond within 6000 ms.' +
            '\n Request Id: randomid' +
            '\n Resource: /search/orgid/userOrgId/entities' +
            '\n Params: {"queryString":"query","resultSize":100,"requestedTypes":["PERSON","ROBOT"]}'
        );
      });

      it('does not fail with timeout when mercury response in time', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'search',
          resource: '/search/orgid/userOrgId/entities',
          params: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
          bodyParams: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
        });

        await clock.tickAsync(5999);

        mercuryCallbacks['event:directory.search'](
          createData(requestId, 1, false, 'directoryEntities', ['data1'])
        );
        mercuryCallbacks['event:directory.search'](
          createData(requestId, 2, true, 'directoryEntities', ['data2'])
        );
        mercuryCallbacks['event:directory.search'](
          createData(requestId, 0, false, 'directoryEntities', ['data0'])
        );

        return assert.isFulfilled(promise);
      });

      it('fails with timeout when request only partially resolved', async () => {
        const {requestId, promise} = await testMakeRequest({
          method: 'search',
          resource: '/search/orgid/userOrgId/entities',
          params: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
          bodyParams: {
            requestedTypes: ['PERSON', 'ROBOT'],
            resultSize: 100,
            queryString: 'query',
          },
        });

        mercuryCallbacks['event:directory.search'](
          createData(requestId, 2, true, 'directoryEntities', ['data2'])
        );
        mercuryCallbacks['event:directory.search'](
          createData(requestId, 0, false, 'directoryEntities', ['data0'])
        );

        promise.catch(() => {}); // to prevent the test from failing due to unhandled promise rejection

        await clock.tickAsync(6000);

        return assert.isRejected(
          promise,
          'The DSS did not respond within 6000 ms.' +
            '\n Request Id: randomid' +
            '\n Resource: /search/orgid/userOrgId/entities' +
            '\n Params: {"queryString":"query","resultSize":100,"requestedTypes":["PERSON","ROBOT"]}'
        );
      });
    });

    describe('#_request', () => {
      it('handles a request correctly', async () => {
        webex.request = sinon.stub();
        uuid.v4();
        const promise = webex.internal.dss._request({
          resource: '/search/orgid/userOrgId/entities',
          params: {some: 'param'},
          dataPath: 'a.b.c',
        });

        expect(webex.request.getCall(0).args).to.deep.equal([
          {
            service: 'directorySearch',
            body: {
              requestId: 'randomid',
              some: 'param',
            },
            contentType: 'application/json',
            method: 'POST',
            resource: '/search/orgid/userOrgId/entities',
          },
        ]);

        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 1,
          a: {b: {c: ['data1']}},
        });
        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 2,
          finished: true,
          a: {b: {c: ['data2']}},
        });
        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 0,
          a: {b: {c: ['data0']}},
        });

        const result = await promise;

        expect(result).to.deep.equal({
          resultArray: ['data0', 'data1', 'data2'],
        });
      });

      it('handles a request with foundPath correctly', async () => {
        webex.request = sinon.stub();
        uuid.v4.returns('randomid');
        const promise = webex.internal.dss._request({
          resource: '/search/orgid/userOrgId/entities',
          params: {some: 'param'},
          dataPath: 'a.b.c',
          foundPath: 'someFoundPath',
        });

        expect(webex.request.getCall(0).args).to.deep.equal([
          {
            service: 'directorySearch',
            body: {
              requestId: 'randomid',
              some: 'param',
            },
            contentType: 'application/json',
            method: 'POST',
            resource: '/search/orgid/userOrgId/entities',
          },
        ]);

        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 1,
          a: {b: {c: ['data1']}},
          someFoundPath: ['id1'],
        });
        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 2,
          finished: true,
          a: {b: {c: ['data2']}},
          someFoundPath: ['id2'],
        });
        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 0,
          a: {b: {c: ['data0']}},
          someFoundPath: ['id0'],
        });

        const result = await promise;

        expect(result).to.deep.equal({
          resultArray: ['data0', 'data1', 'data2'],
          foundArray: ['id0', 'id1', 'id2'],
        });
      });

      it('handles a request with foundPath and notFoundPath correctly', async () => {
        webex.request = sinon.stub();
        uuid.v4.returns('randomid');
        const promise = webex.internal.dss._request({
          resource: '/search/orgid/userOrgId/entities',
          params: {some: 'param'},
          dataPath: 'a.b.c',
          foundPath: 'someFoundPath',
          notFoundPath: 'someNotFoundPath',
        });

        expect(webex.request.getCall(0).args).to.deep.equal([
          {
            service: 'directorySearch',
            body: {
              requestId: 'randomid',
              some: 'param',
            },
            contentType: 'application/json',
            method: 'POST',
            resource: '/search/orgid/userOrgId/entities',
          },
        ]);

        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 1,
          a: {b: {c: ['data1']}},
          someFoundPath: ['id1'],
        });
        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 2,
          finished: true,
          a: {b: {c: ['data2']}},
          someFoundPath: ['id2'],
          someNotFoundPath: ['id3'],
        });
        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 0,
          a: {b: {c: ['data0']}},
          someFoundPath: ['id0'],
        });

        const result = await promise;

        expect(result).to.deep.equal({
          resultArray: ['data0', 'data1', 'data2'],
          foundArray: ['id0', 'id1', 'id2'],
          notFoundArray: ['id3'],
        });
      });
    });

    describe('#_batchedLookup', () => {
      const checkStandardProperties = (batcher) => {
        expect(batcher.dataPath).to.equal('lookupResult.entities');
        expect(batcher.entitiesFoundPath).to.equal('lookupResult.entitiesFound');
        expect(batcher.entitiesNotFoundPath).to.equal('lookupResult.entitiesNotFound');
        expect(batcher.requestKey).to.equal('lookupValues');
        expect(batcher.config).to.deep.equal({
          batcherWait: 50,
          batcherMaxCalls: 50,
          batcherMaxWait: 150,
          requestTimeout: 6000,
        });
      };

      it('calls batcher.request on new batcher for first lookup', async () => {
        const resource = '/lookup/orgid/userOrgId/identities';
        const response = 'response1';

        Batcher.prototype.request = sinon.stub().returns(Promise.resolve(response));

        expect(webex.internal.dss.batchers).to.deep.equal({});

        const result = await webex.internal.dss._batchedLookup({
          resource,
          lookupValue: 'id1',
        });

        const batcher = webex.internal.dss.batchers[resource];

        expect(batcher).to.exist;
        expect(batcher.resource).to.equal(resource);
        checkStandardProperties(batcher);

        expect(Batcher.prototype.request.getCall(0).args).to.deep.equal(['id1']);
        expect(result).to.equal(response);
      });

      it('calls batcher.request on new batcher for lookup with new resource', async () => {
        const resource1 = '/lookup/orgid/userOrgId/identities';
        const resource2 = '/lookup/orgid/userOrgId/entityprovidertype/CI_USER';
        const response1 = 'response1';
        const response2 = 'response2';

        Batcher.prototype.request = sinon
          .stub()
          .onFirstCall()
          .returns(Promise.resolve(response1))
          .onSecondCall()
          .returns(Promise.resolve(response2));

        expect(webex.internal.dss.batchers).to.deep.equal({});

        await webex.internal.dss._batchedLookup({
          resource: resource1,
          lookupValue: 'id1',
        });

        const result = await webex.internal.dss._batchedLookup({
          resource: resource2,
          lookupValue: 'id2',
        });

        expect(webex.internal.dss.batchers[resource1]).to.exist;
        const batcher = webex.internal.dss.batchers[resource2];

        expect(batcher).to.exist;
        expect(batcher.resource).to.equal(resource2);
        checkStandardProperties(batcher);

        expect(Batcher.prototype.request.getCall(1).args).to.deep.equal(['id2']);
        expect(result).to.equal(response2);
      });

      it('calls batcher.request on existing batcher for lookup with existing reource', async () => {
        const resource1 = '/lookup/orgid/userOrgId/identities';
        const response1 = 'response1';
        const response2 = 'response2';

        Batcher.prototype.request = sinon
          .stub()
          .onFirstCall()
          .returns(Promise.resolve(response1))
          .onSecondCall()
          .returns(Promise.resolve(response2));

        expect(webex.internal.dss.batchers).to.deep.equal({});

        await webex.internal.dss._batchedLookup({
          resource: resource1,
          lookupValue: 'id1',
        });
        expect(webex.internal.dss.batchers[resource1]).to.exist;
        const initialBatcher = webex.internal.dss.batchers[resource1];

        const result = await webex.internal.dss._batchedLookup({
          resource: resource1,
          lookupValue: 'id2',
        });

        const batcher = webex.internal.dss.batchers[resource1];

        expect(batcher).to.equal(initialBatcher);
        expect(batcher.resource).to.equal(resource1);
        checkStandardProperties(batcher);

        expect(Batcher.prototype.request.getCall(1).args).to.deep.equal(['id2']);
        expect(result).to.equal(response2);
      });

      it('fails fails when mercury does not respond, later batches can still pass ok', async () => {
        // Batch 1
        const {
          promises: [p1, p2, p3],
        } = await testMakeBatchedRequests({
          requests: [
            {
              id: 'req-id-1',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id1', 'id2', 'id3']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id1', shouldBatch: true},
            },
            {
              method: 'lookup',
              params: {id: 'id2', shouldBatch: true},
            },
            {
              method: 'lookup',
              params: {id: 'id3', shouldBatch: true},
            },
          ],
        });

        // Batch 2
        const {
          promises: [p4],
        } = await testMakeBatchedRequests({
          requests: [
            {
              id: 'randomid',
              resource: '/lookup/orgid/userOrgId/identities',
              bodyParams: {lookupValues: ['id4']},
            },
          ],
          calls: [
            {
              method: 'lookup',
              params: {id: 'id4', shouldBatch: true},
            },
          ],
        });

        // Batch 1 - only 1 mercury response out of 2 received
        mercuryCallbacks['event:directory.lookup'](
          createData('req-id-1', 0, false, 'lookupResult', {
            entitiesFound: ['id1', 'id3'],
            entities: ['data1', 'data3'],
          })
        );

        // Batch 2 - response
        mercuryCallbacks['event:directory.lookup'](
          createData('randomid', 0, true, 'lookupResult', {entitiesNotFound: ['id4']})
        );

        // Timeout
        await clock.tickAsync(6000);

        return Promise.all([
          assert.isRejected(
            p1,
            'The DSS did not respond within 6000 ms.' +
              '\n Request Id: req-id-1' +
              '\n Resource: /lookup/orgid/userOrgId/identities' +
              '\n Params: {"lookupValues":["id1","id2","id3"]}'
          ),
          assert.isRejected(
            p2,
            'The DSS did not respond within 6000 ms.' +
              '\n Request Id: req-id-1' +
              '\n Resource: /lookup/orgid/userOrgId/identities' +
              '\n Params: {"lookupValues":["id1","id2","id3"]}'
          ),
          assert.isRejected(
            p3,
            'The DSS did not respond within 6000 ms.' +
              '\n Request Id: req-id-1' +
              '\n Resource: /lookup/orgid/userOrgId/identities' +
              '\n Params: {"lookupValues":["id1","id2","id3"]}'
          ),
          assert.isFulfilled(p4),
        ]);
      });
    });

    describe('#searchPlaces', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(Promise.resolve('some return value'));

        const result = await webex.internal.dss.searchPlaces({
          resultSize: 100,
          queryString: 'query',
          isOnlySchedulableRooms: true,
        });
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'directoryEntities',
            resource: '/search/orgid/userOrgId/places',
            params: {
              queryString: 'query',
              resultSize: 100,
              isOnlySchedulableRooms: true,
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        await testMakeRequest({
          method: 'searchPlaces',
          resource: '/search/orgid/userOrgId/places',
          params: {
            isOnlySchedulableRooms: true,
            resultSize: 100,
            queryString: 'query',
          },
          bodyParams: {
            isOnlySchedulableRooms: true,
            resultSize: 100,
            queryString: 'query',
          },
        });
      });
    });
  });
});

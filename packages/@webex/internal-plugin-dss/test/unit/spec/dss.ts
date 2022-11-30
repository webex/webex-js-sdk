/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */

import {assert, expect} from '@webex/test-helper-chai';
import DSS from '@webex/internal-plugin-dss';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {set} from 'lodash';
import uuid from 'uuid';

describe('plugin-dss', () => {
  describe('DSS', () => {
    let webex;
    let uuidStub;
    let mercuryCallbacks;

    beforeEach(() => {
      webex = new MockWebex({
        canAuthorize: false,
        children: {
          dss: DSS,
        },
      });

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
    });

    afterEach(() => {
      uuidStub.restore();
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

    const createData = (requestId, sequence, finished, dataPath, results, extraReturnData = {}) => {
      const data = {
        requestId,
        sequence,
        ...extraReturnData,
      };
      if (finished) {
        (data as any).finished = finished;
      }
      set(data, dataPath, results);
      return {data};
    };

    const testRequest = async ({
      method,
      resource,
      params,
      bodyParams,
      dataPath,
      event,
      numResults,
      extraReturnData = {},
    }) => {
      webex.request = sinon.stub();

      await webex.internal.dss.register();

      const promise = webex.internal.dss[method](params);

      const requestId = 'randomid';

      let result;

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

      switch (numResults) {
        case 3:
          mercuryCallbacks[event](createData(requestId, 1, false, dataPath, ['data1']));
          mercuryCallbacks[event](
            createData(requestId, 2, true, dataPath, ['data2'], extraReturnData)
          );
          mercuryCallbacks[event](createData(requestId, 0, false, dataPath, ['data0']));

          result = await promise;
          expect(result).to.deep.equal(['data0', 'data1', 'data2']);
          break;
        case 1:
          mercuryCallbacks[event](
            createData(requestId, 0, true, dataPath, ['data0'], extraReturnData)
          );

          result = await promise;
          expect(result).to.deep.equal('data0');
          break;
        case 0:
          mercuryCallbacks[event](createData(requestId, 0, true, dataPath, [], extraReturnData));

          result = await promise;
          expect(result).to.be.rejectedWith(Error, 'something');
          break;
        default:
          throw new Error('numResults invalid');
      }
    };

    describe('#lookupDetail', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            data: {entitiesFound: ['test id']},
          })
        );

        const result = await webex.internal.dss.lookupDetail({id: 'test id'});
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        await testRequest({
          method: 'lookupDetail',
          dataPath: 'lookupResult.entities',
          event: 'event:directory.lookup',
          resource: '/lookup/orgid/userOrgId/identity/test id/detail',
          params: {
            id: 'test id',
          },
          bodyParams: {},
          numResults: 1,
          extraReturnData: {
            entitiesFound: ['test id'],
          },
        });
      });
    });

    describe('#lookup', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            data: {entitiesFound: ['id1']},
          })
        );

        const result = await webex.internal.dss.lookup({id: 'id1', shouldBatch: false});
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
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
            data: {entitiesFound: ['id1']},
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
            resource: '/lookup/orgid/userOrgId/entityprovidertype/CI_USER',
            params: {
              lookupValues: ['id1'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        await testRequest({
          method: 'lookup',
          dataPath: 'lookupResult.entities',
          event: 'event:directory.lookup',
          resource: '/lookup/orgid/userOrgId/identities',
          params: {
            id: 'id1',
            shouldBatch: false,
          },
          bodyParams: {
            lookupValues: ['id1'],
          },
          numResults: 1,
          extraReturnData: {
            entitiesFound: ['id1'],
          },
        });
      });
    });

    describe('#lookupByEmail', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve({
            resultArray: ['some return value'],
            data: {entitiesFound: ['email1']},
          })
        );

        const result = await webex.internal.dss.lookupByEmail({
          email: 'email1',
        });
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            resource: '/lookup/orgid/userOrgId/emails',
            params: {
              lookupValues: ['email1'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('works correctly', async () => {
        await testRequest({
          method: 'lookupByEmail',
          dataPath: 'lookupResult.entities',
          event: 'event:directory.lookup',
          resource: '/lookup/orgid/userOrgId/emails',
          params: {
            email: 'email1',
          },
          bodyParams: {
            lookupValues: ['email1'],
          },
          numResults: 1,
          extraReturnData: {
            entitiesFound: ['email1'],
          },
        });
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
        await testRequest({
          method: 'search',
          event: 'event:directory.search',
          dataPath: 'directoryEntities',
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
          numResults: 3,
        });
      });
    });

    describe('#_request', () => {
      it('handles a request correctly', async () => {
        webex.request = sinon.stub();
        uuid.v4.returns('randomid');
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
          a: {
            b: {
              c: ['data1'],
            },
          },
        });

        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 2,
          finished: true,
          a: {
            b: {
              c: ['data2'],
            },
          },
        });

        webex.internal.dss.trigger(webex.internal.dss._getResultEventName('randomid'), {
          sequence: 0,
          a: {
            b: {
              c: ['data0'],
            },
          },
        });

        const result = await promise;
        expect(result).to.deep.equal({
          resultArray: ['data0', 'data1', 'data2'],
          data: {
            sequence: 2,
            finished: true,
            a: {
              b: {
                c: ['data2'],
              },
            },
          },
        });
      });
    });
  });
});

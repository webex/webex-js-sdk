/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import DSS from '@webex/internal-plugin-dss';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {expect} from 'chai';
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

    const createData = (requestId, sequence, finished, dataPath) => {
      const data = {
        requestId,
        sequence,
      };
      if (finished) {
        (data as any).finished = finished;
      }
      set(data, dataPath, [`data${sequence}`]);
      return {data};
    };

    const testRequest = async ({method, resource, params, bodyParams, dataPath, event}) => {
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

      mercuryCallbacks[event](createData(requestId, 1, false, dataPath));
      mercuryCallbacks[event](createData(requestId, 2, true, dataPath));
      mercuryCallbacks[event](createData(requestId, 0, false, dataPath));

      const result = await promise;
      expect(result).to.deep.equal(['data0', 'data1', 'data2']);
    };

    describe('#lookupDetail', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(Promise.resolve('some return value'));

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
        });
      });
    });

    describe('#lookup', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(Promise.resolve('some return value'));

        const result = await webex.internal.dss.lookup({ids: ['id1', 'id2']});
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            resource: '/lookup/orgid/userOrgId/identities',
            params: {
              lookupValues: ['id1', 'id2'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });

      it('calls _request correctly with entityProviderType', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(Promise.resolve('some return value'));

        const result = await webex.internal.dss.lookup({
          ids: ['id1', 'id2'],
          entityProviderType: 'CI_USER',
        });
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            resource: '/lookup/orgid/userOrgId/entityprovidertype/CI_USER',
            params: {
              lookupValues: ['id1', 'id2'],
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
            ids: ['id1', 'id2'],
          },
          bodyParams: {
            lookupValues: ['id1', 'id2'],
          },
        });
      });
    });

    describe('#lookupByEmail', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(Promise.resolve('some return value'));

        const result = await webex.internal.dss.lookupByEmail({
          emails: ['email1', 'email2'],
        });
        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'lookupResult.entities',
            resource: '/lookup/orgid/userOrgId/emails',
            params: {
              lookupValues: ['email1', 'email2'],
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
            emails: ['email1', 'email2'],
          },
          bodyParams: {
            lookupValues: ['email1', 'email2'],
          },
        });
      });
    });

    describe('#search', () => {
      it('calls _request correctly', async () => {
        webex.internal.device.orgId = 'userOrgId';
        webex.internal.dss._request = sinon.stub().returns(Promise.resolve('some return value'));

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
        expect(result).to.deep.equal(['data0', 'data1', 'data2']);
      });
    });
  });
});

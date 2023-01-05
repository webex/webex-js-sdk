/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */

import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import DSS from '@webex/internal-plugin-dss';
import DssBatcher from '@webex/internal-plugin-dss/src/dss-batcher';
import MockWebex from '@webex/test-helper-mock-webex';
import {Defer} from '@webex/common';

describe('plugin-dss', () => {
  describe('DssBatcher', () => {
    let batcher;
    let webex;

    beforeEach(() => {
      webex = MockWebex({
        canAuthorize: false,
        children: {
          dss: DSS,
        },
      });
      batcher = new DssBatcher({
        resource: 'fakeResource',
        requestType: 'fakeRequestType',
        dataPath: 'fakeDataPath',
        entitiesFoundPath: 'fakeEntitiesFoundPath',
        entitiesNotFoundPath: 'fakeEntitiesNotFoundPath',
        requestKey: 'fakeRequestKey',
        parent: webex.internal.dss,
      });
      webex.internal.dss.batchers.fakeResource = batcher;
    });

    describe('#submitHttpRequest', () => {
      it('calls dss._request with expected params', async () => {
        webex.internal.dss._request = sinon.stub().returns(
          Promise.resolve('some return value')
        );

        const result = await batcher.submitHttpRequest(['id1']);

        expect(webex.internal.dss._request.getCall(0).args).to.deep.equal([
          {
            dataPath: 'fakeDataPath',
            foundPath: 'fakeEntitiesFoundPath',
            notFoundPath: 'fakeEntitiesNotFoundPath',
            resource: 'fakeResource',
            params: {
              lookupValues: ['id1'],
            },
          },
        ]);
        expect(result).to.equal('some return value');
      });
    });

    describe('#handleHttpSuccess', () => {
      it('calls acceptItem on each found or not found entity', async () => {
        batcher.acceptItem = sinon.stub().returns(Promise.resolve(undefined));
        const res = {
          resultArray: [
            'item1',
            'item2',
          ],
          foundArray: [
            'id1',
            'id2',
          ],
          notFoundArray: [
            'id3',
            'id4',
          ],
        };
        const result = await batcher.handleHttpSuccess(res);

        expect(batcher.acceptItem.getCalls().map((call) => call.args)).to.deep.equal([
          [{requestValue: 'id1', entity: 'item1'}],
          [{requestValue: 'id2', entity: 'item2'}],
          [{requestValue: 'id3', entity: null}],
          [{requestValue: 'id4', entity: null}],
        ]);
        expect(result).to.deep.equal([undefined, undefined, undefined, undefined]);
      });
    });

    describe('#didItemFail', () => {
      it('returns true if item.entity is null', async () => {
        const result = await batcher.didItemFail({entity: null});

        expect(result).to.be.true;
      });

      it('returns true if item.entity is not null', async () => {
        const result = await batcher.didItemFail({entity: 'something'});

        expect(result).to.be.false;
      });
    });

    describe('#handleItemFailure', () => {
      it('rejects defer for item', async () => {
        const defer = new Defer();

        batcher.getDeferredForResponse = sinon.stub().returns(Promise.resolve(defer));
        const result = await batcher.handleItemFailure({requestValue: 'some request'});

        expect(batcher.getDeferredForResponse.getCall(0).args).to.deep.equal([{requestValue: 'some request'}]);
        expect(result).to.be.undefined;
        await expect(defer.promise).to.be.rejectedWith(Error, 'DSS entity with fakeRequestType some request was not found');
      });
    });

    describe('#handleItemSuccess', () => {
      it('resolves defer for item with item.entity', async () => {
        const defer = new Defer();

        batcher.getDeferredForResponse = sinon.stub().returns(Promise.resolve(defer));
        const result = await batcher.handleItemSuccess({entity: 'some entity'});
        const deferValue = await defer.promise;

        expect(batcher.getDeferredForResponse.getCall(0).args).to.deep.equal([{entity: 'some entity'}]);
        expect(result).to.be.undefined;
        expect(deferValue).to.equal('some entity');
      });
    });

    describe('#fingerprintRequest', () => {
      it('returns request', async () => {
        const result = await batcher.fingerprintRequest('some request');

        expect(result).to.equal('some request');
      });
    });

    describe('#fingerprintResponse', () => {
      it('returns response requestValue', async () => {
        const result = await batcher.fingerprintResponse({requestValue: 'some request'});

        expect(result).to.equal('some request');
      });
    });
  });
});

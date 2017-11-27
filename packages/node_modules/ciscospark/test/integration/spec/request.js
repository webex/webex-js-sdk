/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from 'ciscospark';
import pkg from '../../../package';

describe('ciscospark', function () {
  this.timeout(60000);

  let spark;
  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      spark = new CiscoSpark({credentials: user.token});
    }));

  describe('CiscoSpark', () => {
    describe('#request', () => {
      it('can make requests', () => spark.request({
        service: 'hydra',
        resource: '/ping'
      })
        .then((res) => {
          assert.statusCode(res, 200);
          assert.property(res.options, 'headers');
          assert.property(res.options.headers, 'authorization');
          assert.isDefined(res.options.headers.authorization);
          assert.isNotNull(res.options.headers.authorization);
        }));

      it('includes ciscospark in the spark-user-agent header', () => spark.request({
        service: 'hydra',
        resource: '/ping'
      })
        .then((res) => {
          assert.property(res, 'options');
          assert.property(res.options, 'headers');
          assert.property(res.options.headers, 'spark-user-agent');
          assert.equal(res.options.headers['spark-user-agent'], `ciscospark/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`);
        }));

      describe('after registering against wdm', () => {
        before(() => spark.internal.device.register());
        it('can make authorized requests', () => spark.request({
          service: 'hydra',
          resource: '/ping'
        })
          .then((res) => {
            assert.statusCode(res, 200);
            assert.property(res.options, 'headers');
            assert.property(res.options.headers, 'authorization');
            assert.isDefined(res.options.headers.authorization);
            assert.isNotNull(res.options.headers.authorization);
          }));

        it('handles pagination', () => {
          const spy = sinon.spy();
          return Promise.all([
            spark.rooms.create({title: '1'}),
            spark.rooms.create({title: '2'})
          ])
            .then(() => spark.rooms.list({max: 1}))
            .then((rooms) => {
              assert.lengthOf(rooms, 1);
              return (function f(page) {
                for (const room of page) {
                  spy(room.id);
                }

                // by the time this test runs, we're going to have way more than two
                // rooms. This test is really just here to make sure we've addressed
                // the fact that, once registered with wdm, we'll be able to fetch
                // page 1 from hydra-a.wbx2.com and page 2 from api.ciscospark.com.
                if (page.hasNext() && spy.callCount < 2) {
                  return page.next().then(f);
                }

                return Promise.resolve();
              }(rooms));
            })
            .then(() => {
              assert.isAbove(spy.callCount, 1);
            });
        });
      });
    });
  });
});

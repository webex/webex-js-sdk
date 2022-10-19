/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import sinon from 'sinon';
import Webex from 'webex';

import pkg from '../../../package';

describe('webex', function () {
  this.timeout(60000);

  let webex;

  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      webex = new Webex({credentials: user.token});
    }));

  describe('Webex', () => {
    describe('#request', () => {
      it('can make requests', () => webex.request({
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

      it('includes webex in the spark-user-agent header', () => webex.request({
        service: 'hydra',
        resource: '/ping'
      })
        .then((res) => {
          assert.property(res, 'options');
          assert.property(res.options, 'headers');
          assert.property(res.options.headers, 'spark-user-agent');
          assert.equal(res.options.headers['spark-user-agent'], `webex/${pkg.version} (${typeof window === 'undefined' ? 'node' : 'web'})`);
        }));

      describe('after registering against wdm', () => {
        before(() => webex.internal.device.register());
        it('can make authorized requests', () => webex.request({
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
            webex.rooms.create({title: '1'}),
            webex.rooms.create({title: '2'})
          ])
            .then(() => webex.rooms.list({max: 1}))
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

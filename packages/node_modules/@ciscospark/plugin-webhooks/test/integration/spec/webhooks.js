/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import '@ciscospark/plugin-logger';
import '@ciscospark/plugin-rooms';
import '@ciscospark/plugin-webhooks';
import CiscoSpark, {SparkHttpError} from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-webhooks', function () {
  this.timeout(60000);

  let spark;
  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      spark = new CiscoSpark({credentials: user.token});
    }));

  describe('#webhooks', () => {
    let room;
    before(() => spark.rooms.create({
      title: 'Cisco Spark Webhook Test Room'
    })
      .then((r) => { room = r; }));

    let webhook;
    const webhooks = [];
    beforeEach(() => spark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: `roomId=${room.id}`,
      targetUrl: 'https://example.com',
      name: 'Test Webhook'
    })
      .then((w) => {
        webhook = w;
        webhooks.push(webhook);
      }));

    after(() => Promise.all(webhooks.map((webhook) => spark.webhooks.remove(webhook)
      .catch((reason) => {
        console.warn('failed to remove webhook', reason);
      }))));

    after(() => spark.rooms.remove(room)
      .catch((reason) => {
        console.warn('failed to remove room', reason);
      }));

    describe('#create()', () => {
      it('creates a webhook that listens for new messages', () => spark.webhooks.create({
        resource: 'messages',
        event: 'created',
        filter: `roomId=${room.id}`,
        targetUrl: 'https://example.com',
        name: 'Test Webhook'
      })
        .then((webhook) => {
          webhooks.push(webhook);
          assert.isWebhook(webhook);
        }));
    });

    describe('#get()', () => {
      it('retrieves a specific webhook', () => spark.webhooks.get(webhook.id)
        .then((w) => {
          assert.deepEqual(w, webhook);
        }));
    });

    describe('#list()', () => {
      it('retrieves all the webhooks to which I have access', () => spark.webhooks.list()
        .then((webhooks) => {
          assert.isAbove(webhooks.length, 0);
          for (webhook of webhooks) {
            assert.isWebhook(webhook);
          }
          assert.include(webhooks.items, webhook);
        }));

      it('retrieves a bounded set of webhooks', () => {
        const spy = sinon.spy();
        return spark.webhooks.list({max: 1})
          .then((webhooks) => {
            assert.lengthOf(webhooks, 1);
            return (function f(page) {
              for (const webhook of page) {
                spy(webhook.id);
              }

              if (page.hasNext()) {
                return page.next().then(f);
              }

              return Promise.resolve();
            }(webhooks));
          })
          .then(() => {
            assert.isAbove(spy.callCount, 0);
          });
      });
    });

    describe('#update()', () => {
      it('updates the target url of the specified webhook', () => {
        webhook.targetUrl = 'https://example.com/newpath';
        return spark.webhooks.update(webhook)
          .then((w) => {
            assert.deepEqual(w, webhook);
          });
      });

      it('updates the name of the specified webhook', () => {
        webhook.name = 'new name';
        return spark.webhooks.update(webhook)
          .then((w) => {
            assert.deepEqual(w, webhook);
          });
      });
    });

    describe('#remove()', () => {
      it('removes the specified webhook', () => spark.webhooks.remove(webhook)
        .then((body) => {
          assert.notOk(body);
          return assert.isRejected(spark.webhooks.get(webhook));
        })
        .then((reason) => {
          assert.instanceOf(reason, SparkHttpError.NotFound);
        }));
    });
  });
});

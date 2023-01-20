/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/plugin-logger';
import '@webex/plugin-rooms';
import '@webex/plugin-webhooks';
import WebexCore, {WebexHttpError} from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-webhooks', function () {
  this.timeout(60000);

  let webex;

  before(() =>
    testUsers.create({count: 1}).then(([user]) => {
      webex = new WebexCore({credentials: user.token});
    })
  );

  describe('#webhooks', () => {
    let room;

    before(() =>
      webex.rooms
        .create({
          title: 'Webex Webhook Test Room',
        })
        .then((r) => {
          room = r;
        })
    );

    let webhook;
    const webhooks = [];

    beforeEach(() =>
      webex.webhooks
        .create({
          resource: 'messages',
          event: 'created',
          filter: `roomId=${room.id}`,
          targetUrl: 'https://example.com',
          name: 'Test Webhook',
        })
        .then((w) => {
          webhook = w;
          webhooks.push(webhook);
        })
    );

    after(() =>
      Promise.all(
        webhooks.map((webhook) =>
          webex.webhooks.remove(webhook).catch((reason) => {
            console.warn('failed to remove webhook', reason);
          })
        )
      )
    );

    after(() =>
      webex.rooms.remove(room).catch((reason) => {
        console.warn('failed to remove room', reason);
      })
    );

    describe('#create()', () => {
      it('creates a webhook that listens for new messages', () =>
        webex.webhooks
          .create({
            resource: 'messages',
            event: 'created',
            filter: `roomId=${room.id}`,
            targetUrl: 'https://example.com',
            name: 'Test Webhook',
          })
          .then((webhook) => {
            webhooks.push(webhook);
            assert.isWebhook(webhook);
          }));
    });

    describe('#get()', () => {
      it('retrieves a specific webhook', () =>
        webex.webhooks.get(webhook.id).then((w) => {
          assert.deepEqual(w, webhook);
        }));
    });

    describe('#list()', () => {
      it('retrieves all the webhooks to which I have access', () =>
        webex.webhooks.list().then((webhooks) => {
          assert.isAbove(webhooks.length, 0);
          for (webhook of webhooks) {
            assert.isWebhook(webhook);
          }
          assert.include(webhooks.items, webhook);
        }));

      it('retrieves a bounded set of webhooks', () => {
        const spy = sinon.spy();

        return webex.webhooks
          .list({max: 1})
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
            })(webhooks);
          })
          .then(() => {
            assert.isAbove(spy.callCount, 0);
          });
      });
    });

    describe('#update()', () => {
      it('updates the target url of the specified webhook', () => {
        webhook.targetUrl = 'https://example.com/newpath';

        return webex.webhooks.update(webhook).then((w) => {
          assert.deepEqual(w, webhook);
        });
      });

      it('updates the name of the specified webhook', () => {
        webhook.name = 'new name';

        return webex.webhooks.update(webhook).then((w) => {
          assert.deepEqual(w, webhook);
        });
      });
    });

    describe('#remove()', () => {
      it('removes the specified webhook', () =>
        webex.webhooks
          .remove(webhook)
          .then((body) => {
            assert.notOk(body);

            return assert.isRejected(webex.webhooks.get(webhook));
          })
          .then((reason) => {
            assert.instanceOf(reason, WebexHttpError.NotFound);
          }));
    });
  });
});

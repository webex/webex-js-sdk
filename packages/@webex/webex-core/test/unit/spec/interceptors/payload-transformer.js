/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {capitalize} from 'lodash';
import sinon from 'sinon';
import WebexCore, {PayloadTransformerInterceptor} from '@webex/webex-core';
// TODO:  fix circular dependency core->metrics->core https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-515520
require('@webex/internal-plugin-metrics');

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('PayloadTransformerInterceptor', () => {
      let webex;

      beforeEach(() => {
        webex = new WebexCore({
          config: {
            payloadTransformer: {
              predicates: [
                {
                  name: 'transformObject',
                  direction: 'outbound',
                  test(ctx, options) {
                    return Promise.resolve(
                      Boolean(options && options.body && options.body.objectType)
                    );
                  },
                  extract(options) {
                    return Promise.resolve(options.body);
                  },
                },
              ],
              transforms: [
                {
                  name: 'transformObject',
                  fn(ctx, object) {
                    return ctx
                      .transform('normalizeObject', object)
                      .then((object) => ctx.transform('encryptObject', object));
                  },
                },
                {
                  name: 'normalizeObject',
                  fn(ctx, object) {
                    if (!object) {
                      return Promise.resolve();
                    }

                    return Promise.all([
                      ctx.transform(`normalize${capitalize(object.objectType)}`, object),
                      ctx.transform('normalizePropDisplayName', object),
                      ctx.transform('normalizePropContent', object),
                    ]);
                  },
                },
                {
                  name: 'normalizeActivity',
                  fn(ctx, activity) {
                    return Promise.all([
                      ctx.transform('normalizeObject', activity.actor),
                      ctx.transform('normalizeObject', activity.object),
                      ctx.transform('normalizeObject', activity.target),
                    ]);
                  },
                },
                {
                  name: 'normalizePerson',
                  fn(ctx, actor) {
                    actor.id = 'uuid';

                    return Promise.resolve();
                  },
                },
                {
                  name: 'normalizeComment',
                  fn(ctx, comment) {
                    comment.content = 'richtext';

                    return Promise.resolve();
                  },
                },
                {
                  name: 'encryptObject',
                  fn(ctx, key, object) {
                    if (arguments.length === 2) {
                      object = key;
                      key = undefined;
                    }

                    if (!key) {
                      key = 'kms://example.com/uuid';
                      object.encryptionKeyUrl = key;
                    }

                    return ctx.transform(`encrypt${capitalize(object.objectType)}`, key, object);
                  },
                },
                {
                  name: 'encryptActivity',
                  fn(ctx, key, activity) {
                    return ctx.transform('encryptComment', key, activity.object);
                  },
                },
                {
                  name: 'encryptComment',
                  fn(ctx, key, object) {
                    object.displayName = 'ciphertextDISPLAYNAME';
                    object.content = 'ciphertextCONTENT';

                    return Promise.resolve();
                  },
                },
              ],
            },
          },
        });
      });

      describe('#transform()', () => {
        it('transforms request objects', () =>
          webex
            .transform('outbound', {
              body: {
                actor: {
                  id: 'me@wx2.example.com',
                  objectType: 'person',
                },
                object: {
                  content: '<invalidtag>richtext</invalidtag>',
                  displayName: 'plaintext',
                  objectType: 'comment',
                },
                objectType: 'activity',
              },
            })
            .then((result) =>
              assert.deepEqual(result, {
                body: {
                  actor: {
                    id: 'uuid',
                    objectType: 'person',
                  },
                  encryptionKeyUrl: 'kms://example.com/uuid',
                  object: {
                    content: 'ciphertextCONTENT',
                    displayName: 'ciphertextDISPLAYNAME',
                    objectType: 'comment',
                  },
                  objectType: 'activity',
                },
              })
            ));
      });
    });

    describe('PayloadTransformerInterceptor repeated inbound transforms', () => {
      const createInterceptor = (skipRepeatedInboundTransforms) => {
        const transform = sinon.stub().callsFake((direction, value) => Promise.resolve(value));
        const interceptor = new PayloadTransformerInterceptor({
          webex: {
            config: {payloadTransformer: {skipRepeatedInboundTransforms}},
            transform,
          },
        });

        return {interceptor, transform};
      };

      describe('#onResponse()', () => {
        it('transforms the same response every time when skipping repeated transforms is disabled', async () => {
          const {interceptor, transform} = createInterceptor(false);
          const response = {};

          await interceptor.onResponse({}, response);
          await interceptor.onResponse({}, response);

          assert.calledTwice(transform);
        });

        it('transforms the same response only once when repeated transforms are skipped', async () => {
          const {interceptor, transform} = createInterceptor(true);
          const response = {};

          assert.equal(await interceptor.onResponse({}, response), response);
          assert.equal(await interceptor.onResponse({}, response), response);
          assert.calledOnceWithExactly(transform, 'inbound', response);
        });

        it('transforms distinct response objects independently', async () => {
          const {interceptor, transform} = createInterceptor(true);
          const firstResponse = {};
          const secondResponse = {};

          await interceptor.onResponse({}, firstResponse);
          await interceptor.onResponse({}, secondResponse);

          assert.calledTwice(transform);
          assert.isTrue(transform.firstCall.calledWithExactly('inbound', firstResponse));
          assert.isTrue(transform.secondCall.calledWithExactly('inbound', secondResponse));
        });

        it('retries transformation after a failed transform', async () => {
          const {interceptor, transform} = createInterceptor(true);
          const response = {};

          transform.onFirstCall().rejects(new Error('transform failed'));

          await assert.isRejected(interceptor.onResponse({}, response), 'transform failed');
          assert.equal(await interceptor.onResponse({}, response), response);
          assert.calledTwice(transform);
        });

        it('does not mark a response when transforms are disabled for that request', async () => {
          const {interceptor, transform} = createInterceptor(true);
          const response = {};

          assert.equal(await interceptor.onResponse({disableTransform: true}, response), response);
          assert.equal(await interceptor.onResponse({}, response), response);
          assert.calledOnceWithExactly(transform, 'inbound', response);
        });
      });

      describe('#onResponseError()', () => {
        it('transforms the same error only once while preserving rejection behavior', async () => {
          const {interceptor, transform} = createInterceptor(true);
          const reason = new Error('request failed');

          await assert.isRejected(interceptor.onResponseError({}, reason), 'request failed');
          await assert.isRejected(interceptor.onResponseError({}, reason), 'request failed');
          assert.calledOnceWithExactly(transform, 'inbound', reason);
        });
      });
    });
  });
});

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {capitalize} from 'lodash';
import WebexCore from '@webex/webex-core';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('PayloadTransformerInterceptor', () => {
      let webex;

      beforeEach(() => {
        webex = new WebexCore({
          config: {
            payloadTransformer: {
              predicates: [{
                name: 'transformObject',
                direction: 'outbound',
                test(ctx, options) {
                  return Promise.resolve(Boolean(options && options.body && options.body.objectType));
                },
                extract(options) {
                  return Promise.resolve(options.body);
                }
              }],
              transforms: [
                {
                  name: 'transformObject',
                  fn(ctx, object) {
                    return ctx.transform('normalizeObject', object)
                      .then((object) => ctx.transform('encryptObject', object));
                  }
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
                      ctx.transform('normalizePropContent', object)
                    ]);
                  }
                },
                {
                  name: 'normalizeActivity',
                  fn(ctx, activity) {
                    return Promise.all([
                      ctx.transform('normalizeObject', activity.actor),
                      ctx.transform('normalizeObject', activity.object),
                      ctx.transform('normalizeObject', activity.target)
                    ]);
                  }
                },
                {
                  name: 'normalizePerson',
                  fn(ctx, actor) {
                    actor.id = 'uuid';

                    return Promise.resolve();
                  }
                },
                {
                  name: 'normalizeComment',
                  fn(ctx, comment) {
                    comment.content = 'richtext';

                    return Promise.resolve();
                  }
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
                  }
                },
                {
                  name: 'encryptActivity',
                  fn(ctx, key, activity) {
                    return ctx.transform('encryptComment', key, activity.object);
                  }
                },
                {
                  name: 'encryptComment',
                  fn(ctx, key, object) {
                    object.displayName = 'ciphertextDISPLAYNAME';
                    object.content = 'ciphertextCONTENT';

                    return Promise.resolve();
                  }
                }
              ]
            }
          }
        });
      });

      describe('#transform()', () => {
        it('transforms request objects', () => webex.transform('outbound', {
          body: {
            actor: {
              id: 'me@wx2.example.com',
              objectType: 'person'
            },
            object: {
              content: '<invalidtag>richtext</invalidtag>',
              displayName: 'plaintext',
              objectType: 'comment'
            },
            objectType: 'activity'
          }
        })
          .then((result) => assert.deepEqual(result, {
            body: {
              actor: {
                id: 'uuid',
                objectType: 'person'
              },
              encryptionKeyUrl: 'kms://example.com/uuid',
              object: {
                content: 'ciphertextCONTENT',
                displayName: 'ciphertextDISPLAYNAME',
                objectType: 'comment'
              },
              objectType: 'activity'
            }
          })));
      });
    });
  });
});

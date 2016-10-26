/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Spark from '../../..';
import S from 'string';

describe(`spark-core`, () => {
  describe(`Interceptors`, () => {
    describe(`PayloadTransformerInterceptor`, () => {
      let spark;
      beforeEach(() => {
        spark = new Spark({
          config: {
            payloadTransformer: {
              predicates: [{
                name: `transformObject`,
                direction: `outbound`,
                test(ctx, options) {
                  return Promise.resolve(Boolean(options && options.body && options.body.objectType));
                },
                extract(options) {
                  return Promise.resolve(options.body);
                }
              }],
              transforms: [
                {
                  name: `transformObject`,
                  fn(ctx, object) {
                    return ctx.transform(`normalizeObject`, object)
                      .then((object) => ctx.transform(`encryptObject`, object));
                  }
                },
                {
                  name: `normalizeObject`,
                  fn(ctx, object) {
                    if (!object) {
                      return Promise.resolve();
                    }
                    return Promise.all([
                      ctx.transform(`normalize${S(object.objectType).capitalize().s}`, object),
                      ctx.transform(`normalizePropDisplayName`, object),
                      ctx.transform(`normalizePropContent`, object)
                    ]);
                  }
                },
                {
                  name: `normalizeActivity`,
                  fn(ctx, activity) {
                    return Promise.all([
                      ctx.transform(`normalizeObject`, activity.actor),
                      ctx.transform(`normalizeObject`, activity.object),
                      ctx.transform(`normalizeObject`, activity.target)
                    ]);
                  }
                },
                {
                  name: `normalizePerson`,
                  fn(ctx, actor) {
                    actor.id = `uuid`;
                    return Promise.resolve();
                  }
                },
                {
                  name: `normalizeComment`,
                  fn(ctx, comment) {
                    comment.content = `richtext`;
                    return Promise.resolve();
                  }
                },
                {
                  name: `encryptObject`,
                  fn(ctx, key, object) {
                    if (arguments.length === 2) {
                      object = key;
                      key = undefined;
                    }

                    if (!key) {
                      key = `kms://example.com/uuid`;
                      object.encryptionKeyUrl = key;
                    }
                    return ctx.transform(`encrypt${S(object.objectType).capitalize().s}`, key, object);
                  }
                },
                {
                  name: `encryptActivity`,
                  fn(ctx, key, activity) {
                    return ctx.transform(`encryptComment`, key, activity.object);
                  }
                },
                {
                  name: `encryptComment`,
                  fn(ctx, key, object) {
                    object.displayName = `ciphertextDISPLAYNAME`;
                    object.content = `ciphertextCONTENT`;

                    return Promise.resolve();
                  }
                }
              ]
            }
          }
        });
      });

      describe(`#transform()`, () => {
        it(`transforms request objects`, () => assert.becomes(spark.transform(`outbound`, {
          body: {
            actor: {
              id: `me@wx2.example.com`,
              objectType: `person`
            },
            object: {
              content: `<invalidtag>richtext</invalidtag>`,
              displayName: `plaintext`,
              objectType: `comment`
            },
            objectType: `activity`
          }
        }), {
          body: {
            actor: {
              id: `uuid`,
              objectType: `person`
            },
            encryptionKeyUrl: `kms://example.com/uuid`,
            object: {
              content: `ciphertextCONTENT`,
              displayName: `ciphertextDISPLAYNAME`,
              objectType: `comment`
            },
            objectType: `activity`
          }
        }));
      });
    });
  });
});

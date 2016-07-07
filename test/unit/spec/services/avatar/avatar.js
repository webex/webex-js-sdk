/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Avatar = require('../../../../../src/client/services/avatar');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Avatar', function() {
    var avatar;
    var spark;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          avatar: Avatar
        }
      });

      spark.config = {
        avatar: {
          bulkFetchDebounceDelay: 5,
          defaultAvatarSize: 80
        }
      };

      avatar = spark.avatar;
    });

    describe('#retrieveAvatarUrl', function() {
      it('requires a user identifying object', function() {
        return Promise.all([
          assert.isRejected(avatar.retrieveAvatarUrl(), /`user` is a required parameter/)
        ]);
      });

      describe('(unbatched)', function() {
        it('retrieves an avatar url', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                80: {
                  size: 80,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [80]
                }
              ]
            }
          }));

          return assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0'), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0');
        });

        it('fails to retrieve an avatar url', function() {
          spark.request = sinon.stub().returns(Promise.reject({
            body: '',
            statusCode: 500,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [80]
                }
              ]
            }
          }));

          return assert.isRejected(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0'), /bulk retrieval for avatar urls failed/);
        });

        it('retrieves an avatar url for a non-default size', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                110: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [110]
                }
              ]
            }
          }));

          return assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 110}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40');
        });

        it('retrieves an avatar url for a non-standard size', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                35: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [35]
                }
              ]
            }
          }));

          return assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 35}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40');
        });
      });

      describe('(batched)', function() {
        it('retrieves a group of avatar urls', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                80: {
                  size: 80,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0'
                }
              },
              '88888888-4444-4444-4444-aaaaaaaaaaa1': {
                80: {
                  size: 80,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [80]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [80]
                }
              ]
            }
          }));

          return Promise.all([
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0'), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0'),
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1'), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1')
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });

        it('rejects each requested avatar if the api call fails', function() {
          spark.request = sinon.stub().returns(Promise.reject({
            body: '',
            statusCode: 500,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [80]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [80]
                }
              ]
            }
          }));

          var a0 = avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0');
          var a1 = avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1');

          return Promise.all([
            assert.isRejected(a1, /bulk retrieval for avatar urls failed/),
            assert.isRejected(a0, /bulk retrieval for avatar urls failed/)
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });

        it('rejects each avatar missing from the response', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                80: {
                  size: 80,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [80]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [80]
                }
              ]
            }
          }));

          return Promise.all([
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0'), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0'),
            assert.isRejected(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1'), /requested uuid not found in bulk avatar payload/)
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });

        it('retrieves avatar urls for homogenous, non-default sizes', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'
                }
              },
              '88888888-4444-4444-4444-aaaaaaaaaaa1': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--40'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [40]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [40]
                }
              ]
            }
          }));

          return Promise.all([
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 40}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'),
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 40}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--40')
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });

        it('retrieves avatar urls for heterogneous, non-default sizes', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'
                }
              },
              '88888888-4444-4444-4444-aaaaaaaaaaa1': {
                110: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--110'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [40]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [110]
                }
              ]
            }
          }));

          return Promise.all([
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 40}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'),
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 110}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--110')
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });

        it('retrieves avatar urls for multiple sizes for the same user', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'
                }
              },
              '88888888-4444-4444-4444-aaaaaaaaaaa1': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--40'
                },
                110: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--110'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [40]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [40, 110]
                }
              ]
            }
          }));

          return Promise.all([
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 40}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--40'),
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 40}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--40'),
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 110}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--110')
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });

        it('retrieves avatar urls for homogenous, non-standard sizes', function() {
          spark.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                100: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--110'
                }
              },
              '88888888-4444-4444-4444-aaaaaaaaaaa1': {
                100: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--110'
                }
              }
            },
            statusCode: 200,
            options: {
              ids: [
                '88888888-4444-4444-4444-aaaaaaaaaaa0',
                '88888888-4444-4444-4444-aaaaaaaaaaa1'
              ],
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [100]
                },
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                  sizes: [100]
                }
              ]
            }
          }));

          return Promise.all([
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 100}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0--110'),
            assert.becomes(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 100}), 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1--110')
          ])
            .then(function() {
              assert.callCount(spark.request, 1);
            });
        });
      });
    });

  });
});

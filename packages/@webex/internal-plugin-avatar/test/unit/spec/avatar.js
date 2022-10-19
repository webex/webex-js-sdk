/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Avatar from '@webex/internal-plugin-avatar';
import {WebexHttpError} from '@webex/webex-core';
import User from '@webex/internal-plugin-user';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('plugin-avatar', () => {
  let avatar;
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        avatar: Avatar,
        user: User
      }
    });
    avatar = webex.internal.avatar;
    avatar.config.batcherWait = 1500;
    avatar.config.batcherMaxCalls = 100;
    avatar.config.batcherMaxWait = 100;
    avatar.config.defaultMaxAge = 60 * 60;
    avatar.config.defaultAvatarSize = 80;
    avatar.config.cacheControl = 3600;
    avatar.config.sizes = [40, 50, 80, 110, 135, 192, 640, 1600];
  });

  describe('#retrieveAvatarUrl()', () => {
    it('requires a user identifying object', () => Promise.all([
      assert.isRejected(avatar.retrieveAvatarUrl(), '\'user\' is a required parameter')
    ]));

    describe('when retrieving a single item', () => {
      it('retrieves an avatar url', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
          .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80'));
      });

      it('fails to retrieve an avatar url', () => {
        webex.request = sinon.stub().returns(Promise.reject(new WebexHttpError.InternalServerError({
          body: '',
          statusCode: 500,
          options: {
            method: 'POST',
            uri: 'https://avatar.example.com',
            headers: {
              trackingid: 'tid'
            },
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [80],
                cacheControl: 'public max-age=3600'
              }
            ]
          }
        })));

        return assert.isRejected(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0'));
      });

      it('retrieves an avatar url for a non-default size', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 110})
          .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110'));
      });

      it('retrieves an avatar url for a non-standard size', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              35: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [35, 40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 35})
          .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40'));
      });

      describe('when options.hideDefaultAvatar is true', () => {
        it('returns null if it is a default avatar and options.hideDefaultAvatar is true', () => {
          webex.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                50: {
                  size: 50,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                80: {
                  size: 80,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                110: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                135: {
                  size: 135,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                192: {
                  size: 192,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                640: {
                  size: 640,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                },
                1600: {
                  size: 1600,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                  cacheControl: 'public max-age=3600',
                  defaultAvatar: true
                }
              }
            },
            statusCode: 200,
            options: {
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
                }
              ]
            }
          }));
          const deferred = avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {hideDefaultAvatar: true});

          return deferred
            .then((res) => assert.isNotOk(res));
        });

        it('retrieves avatar url if it is not a default avatar and options.hideDefaultAvatar is true', () => {
          webex.request = sinon.stub().returns(Promise.resolve({
            body: {
              '88888888-4444-4444-4444-aaaaaaaaaaa0': {
                40: {
                  size: 40,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                  cacheControl: 'public max-age=3600'
                },
                50: {
                  size: 50,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                  cacheControl: 'public max-age=3600'
                },
                80: {
                  size: 80,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                  cacheControl: 'public max-age=3600'
                },
                110: {
                  size: 110,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                  cacheControl: 'public max-age=3600'
                },
                135: {
                  size: 135,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                  cacheControl: 'public max-age=3600'
                },
                192: {
                  size: 192,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                  cacheControl: 'public max-age=3600'
                },
                640: {
                  size: 640,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                  cacheControl: 'public max-age=3600'
                },
                1600: {
                  size: 1600,
                  url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                  cacheControl: 'public max-age=3600'
                }
              }
            },
            statusCode: 200,
            options: {
              body: [
                {
                  uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                  sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
                }
              ]
            }
          }));
          const deferred = avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {hideDefaultAvatar: true});

          return deferred
            .then((res) => assert.deepEqual(res, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80'));
        });
      });
    });

    describe('when retrieving multiple items', () => {
      it('retrieves a group of avatar urls', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa1': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80'))
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('rejects each requested avatar if the api call fails', () => {
        webex.request = sinon.stub().returns(Promise.reject(new WebexHttpError.InternalServerError({
          body: '',
          statusCode: 500,
          options: {
            method: 'POST',
            uri: 'https://avatar.example.com',
            headers: {
              trackingid: 'tid'
            },
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [80],
                cacheControl: 'public max-age=3600'
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [80],
                cacheControl: 'public max-age=3600'
              }
            ]
          }
        })));

        const a0 = avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0');
        const a1 = avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1');

        return Promise.all([
          assert.isRejected(a1),
          assert.isRejected(a0)
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('rejects each avatar missing from the response', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80')),
          assert.isRejected(avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1'), /Failed to retrieve avatar/)
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('retrieves avatar urls for homogenous, non-default sizes', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa1': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 40})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 40})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40'))
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('retrieves avatar urls for heterogneous, non-default sizes', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa1': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 40})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 110})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110'))
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('retrieves avatar urls for multiple sizes for the same user', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa1': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 40})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 40})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 110})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110'))
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('retrieves avatar urls for homogenous, non-standard sizes', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              100: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa1': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80',
                cacheControl: 'public max-age=3600'
              },
              100: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 100, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 100, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0', {size: 100})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1', {size: 100})
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110'))
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });

      it('retrieves a group of avatar urls (with duplicate requests)', () => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {
            '88888888-4444-4444-4444-aaaaaaaaaaa0': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa1': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa2': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa3': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa4': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~1600',
                cacheControl: 'public max-age=3600'
              }
            },
            '88888888-4444-4444-4444-aaaaaaaaaaa5': {
              40: {
                size: 40,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~40',
                cacheControl: 'public max-age=3600'
              },
              50: {
                size: 50,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~50',
                cacheControl: 'public max-age=3600'
              },
              80: {
                size: 80,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~80',
                cacheControl: 'public max-age=3600'
              },
              110: {
                size: 110,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~110',
                cacheControl: 'public max-age=3600'
              },
              135: {
                size: 135,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~135',
                cacheControl: 'public max-age=3600'
              },
              192: {
                size: 192,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~192',
                cacheControl: 'public max-age=3600'
              },
              640: {
                size: 640,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~640',
                cacheControl: 'public max-age=3600'
              },
              1600: {
                size: 1600,
                url: 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~1600',
                cacheControl: 'public max-age=3600'
              }
            }
          },
          statusCode: 200,
          options: {
            body: [
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa0',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa1',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa2',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa3',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa4',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              },
              {
                uuid: '88888888-4444-4444-4444-aaaaaaaaaaa5',
                sizes: [40, 50, 80, 110, 135, 192, 640, 1600]
              }
            ]
          }
        }));

        return Promise.all([
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa2')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa3')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa4')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80')),

          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa2')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa4')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa4')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa4')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa2')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa2')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa2~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa3')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa3~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa1')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa1~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa4')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa4')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa4~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa0')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa0~80')),
          avatar.retrieveAvatarUrl('88888888-4444-4444-4444-aaaaaaaaaaa5')
            .then((result) => assert.deepEqual(result, 'https://example.com/88888888-4444-4444-4444-aaaaaaaaaaa5~80'))
        ])
          .then(() => {
            assert.callCount(webex.request, 1);
          });
      });
    });
  });
});

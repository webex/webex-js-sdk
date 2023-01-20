/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser} from '@webex/common';
import {assert} from '@webex/test-helper-chai';
import file from '@webex/test-helper-file';
import {HttpError, request} from '@webex/http-core';
import makeLocalUrl from '@webex/test-helper-make-local-url';
import sinon from 'sinon';
import {flaky, nodeOnly} from '@webex/test-helper-mocha';

describe('http-core', function () {
  this.timeout(30000);
  describe('request()', () => {
    describe('GET', () => {
      it('retrieves html', () =>
        request({uri: makeLocalUrl('/')}).then((res) => {
          assert.statusCode(res, 200);
          assert.isString(res.body);
        }));

      it('attaches the request options object to every response', () =>
        request(makeLocalUrl('/')).then((res) => {
          assert.property(res, 'options');
          assert.property(res.options, 'uri');
          assert.equal(res.options.uri, makeLocalUrl('/'));
        }));

      it('accepts `uri` as a separate parameter from `options`', () =>
        request(makeLocalUrl('/')).then((res) => {
          assert.statusCode(res, 200);
          assert.isString(res.body);
        }));

      it('normalizes `options.url` as `options.uri`', () =>
        request({url: makeLocalUrl('/')}).then((res) => {
          assert.statusCode(res, 200);
          assert.isString(res.body);
        }));

      it('retrieves JSON', () =>
        request({uri: makeLocalUrl('/json/get')}).then((res) => {
          assert.statusCode(res, 200);
          assert.isObject(res.body);
          assert.deepEqual(res.body, {isObject: true});
        }));

      it('emits download progress events', () => {
        const options = {uri: makeLocalUrl('/sample-image-small-one.png')};
        const promise = request(options);
        const spy = sinon.spy();

        options.download.on('progress', spy);

        return promise.then(() => {
          assert.called(spy);
        });
      });

      describe('with responseType="buffer"', () => {
        it('retrieves a file as a buffer', () =>
          request({
            uri: makeLocalUrl('/sample-image-small-one.png'),
            responseType: 'buffer',
          }).then((res) => {
            assert.isBufferLike(res.body);
          }));
      });

      describe('with responseType="blob"', () => {
        it('retrieves a file as a file', () =>
          request({
            uri: makeLocalUrl('/sample-image-small-one.png'),
            responseType: 'blob',
          }).then((res) => {
            assert.isBlobLike(res.body);
          }));
      });

      it('makes CORS compatible calls', () =>
        request({
          uri: 'https://ds.ciscospark.com/v1/region/',
        }).then((res) => {
          assert.notEqual(res.statusCode, 0);
        }));

      it('fails with a subtyped error', () =>
        assert
          .isRejected(
            request({
              uri: makeLocalUrl('/not-a-route'),
            })
          )
          .then((err) => {
            assert.instanceOf(err, HttpError);
            assert.instanceOf(err, HttpError.BadRequest);
          }));

      // This is somewhat difficult to test in web browser, but network errors in
      // browser look like network errors in browsers, so testing it isn`t that
      // critical. That said, moving the error-reformatting logic out of the
      // environment-specific implementations may make this easier to stub.
      nodeOnly(it)('makes network errors look mostly like HTTP errors', () =>
        assert.isRejected(request('https://localhost:0/not-a-route')).then((err) => {
          assert.instanceOf(err, HttpError.NetworkOrCORSError);
        })
      );

      it('passes cookies', () =>
        request({
          uri: makeLocalUrl('/cookies/set'),
          jar: true,
        })
          .then(() =>
            request({
              uri: makeLocalUrl('/cookies/expect'),
              jar: true,
            })
          )
          .then((res) => {
            assert.statusCode(res, 200);
          }));

      // this test fails in Safari 8+
      nodeOnly(it)('passes cookies to endpoints on other origins', () => {
        const p1 = request({
          uri: `http://localhost:${process.env.CORS_PORT}/cookies/set`,
          jar: true,
        })
          .then(() =>
            request({
              uri: `http://localhost:${process.env.CORS_PORT}/cookies/expect`,
              jar: true,
            })
          )
          .then((res) => {
            assert.statusCode(res, 200);
          });

        const p2 = request({
          uri: `http://localhost:${process.env.CORS_PORT}/cookies/set`,
          withCredentials: true,
        })
          .then(() =>
            request({
              uri: `http://localhost:${process.env.CORS_PORT}/cookies/expect`,
              withCredentials: true,
            })
          )
          .then((res) => {
            assert.statusCode(res, 200);
          });

        return Promise.all([p1, p2]);
      });

      it('makes Basic Auth authenticated requests', () => {
        const p1 = request({
          uri: makeLocalUrl('/requires-basic-auth'),
          auth: {
            pass: 'basicpass',
            user: 'basicuser',
          },
        }).then((res) => {
          assert.statusCode(res, 200);
        });

        const p2 = request({
          uri: makeLocalUrl('/requires-basic-auth'),
          auth: {
            password: 'basicpass',
            username: 'basicuser',
          },
        }).then((res) => {
          assert.statusCode(res, 200);
        });

        return Promise.all([p1, p2]);
      });

      it('makes Bearer Auth authenticated requests', () =>
        request({
          uri: makeLocalUrl('/requires-bearer-auth'),
          auth: {
            bearer: 'bearertoken',
          },
        }).then((res) => {
          assert.statusCode(res, 200);
        }));

      it('encodes querystring parameters', () => {
        // treat all types as strings because that`s how querystrings get parsed
        // on the server
        const qs = {
          string: 'this is a string',
          object: {
            string: 'this is a another string',
            boolean: 'true',
            integer: '5',
          },
        };

        return request({
          uri: makeLocalUrl('/return-qs-as-object'),
          qs,
        }).then((res) => {
          assert.deepEqual(res.body, qs);
        });
      });
    });

    flaky(it, process.env.SKIP_FLAKY_TESTS)('submits files as multipart form data', () => {
      file.fetch('sample-powerpoint-two-page.ppt').then((f) =>
        request({
          method: 'POST',
          uri: makeLocalUrl('/files/metadata'),
          formData: {
            files: [f],
          },
          json: true,
        }).then((res) => {
          // This asserts that the server received the file and was able to
          // decode its filename.
          assert.equal(res.body[0].originalname, f.name);
        })
      );
    });

    ['PUT', 'PATCH', 'POST'].forEach((method) => {
      describe(method, () => {
        it('submits json', () => {
          const payload = {
            string: 'this is a string',
            object: {
              string: 'this is a another string',
              boolean: 'true',
              integer: '5',
            },
          };

          return request({
            method,
            uri: makeLocalUrl('/json/set'),
            body: payload,
          }).then((res) => {
            assert.statusCode(res, 200);
            assert.deepEqual(res.body, payload);
          });
        });

        it('submits urlencoded form data', () =>
          // treat all types as strings because that`s how querystrings get parsed
          // on the server
          request({
            method,
            uri: makeLocalUrl('/form/reflect'),
            form: {
              a: 1,
              b: 2,
            },
          }).then((res) => {
            assert.statusCode(res, 200);
            assert.deepEqual(res.body, {
              a: '1',
              b: '2',
            });
          }));

        it('submits files', () =>
          file.fetch('/sample-image-small-one.png').then((f) =>
            request({
              method,
              uri: makeLocalUrl('/files/reflect'),
              body: f,
              json: false,
              // Note: setting response type so the `reflect()ed` response is in
              // a form we can use, this is not needed for normal file uploads.
              responseType: 'blob',
            }).then((res) => {
              assert.equal(res.body.type, f.type);

              return file.isMatchingFile(res.body, f).then((result) => assert.isTrue(result));
            })
          ));

        (inBrowser ? it : it.skip)('emits upload progress events', () =>
          file.fetch('/sample-image-small-one.png').then((f) => {
            const options = {
              method,
              uri: makeLocalUrl('/files/reflect'),
              body: f,
              json: false,
            };

            const promise = request(options);

            const spy = sinon.spy();

            options.upload.on('progress', spy);

            return promise.then(() => {
              assert.called(spy);
            });
          })
        );
      });
    });
  });
});

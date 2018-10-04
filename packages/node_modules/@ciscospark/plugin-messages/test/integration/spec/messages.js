/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';
import '@ciscospark/plugin-logger';
import '@ciscospark/plugin-messages';
import '@ciscospark/plugin-rooms';
import CiscoSpark, {SparkHttpError} from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import testUsers from '@ciscospark/test-helper-test-users';
import fh from '@ciscospark/test-helper-file';
import {browserOnly, flaky, nodeOnly} from '@ciscospark/test-helper-mocha';

const KNOWN_HOSTED_IMAGE_URL = 'https://download.ciscospark.com/test/photo.png';

describe('plugin-messages', function () {
  this.timeout(60000);

  let spark;
  before(() => testUsers.create({count: 1})
    .then(([user]) => {
      spark = new CiscoSpark({credentials: user.token});
    }));

  describe('#messages', () => {
    let room;
    before(() => spark.rooms.create({title: 'Cisco Spark Test Room'})
      .then((r) => {
        room = r;
        return spark.messages.create({
          roomId: room.id,
          text: 'First Message'
        });
      }));

    after(() => {
      if (!room) {
        return Promise.resolve();
      }

      return spark.rooms.remove(room)
        .catch((reason) => {
          console.error('Failed to remove room', reason);
        });
    });

    describe('#create()', () => {
      it('posts a message in a room', () => {
        const text = 'A test message';
        return spark.messages.create({
          roomId: room.id,
          text
        })
          .then((message) => {
            assert.isDefined(message);
            assert.isMessage(message);
            assert.equal(message.text, text);
          });
      });

      it('posts a file to a room by specifying the file\'s url', () => spark.messages.create({
        roomId: room.id,
        file: KNOWN_HOSTED_IMAGE_URL
      })
        .then((message) => {
          assert.property(message, 'files');
          assert.isDefined(message.files);
          assert.isArray(message.files);
          assert.lengthOf(message.files, 1);
        }));

      let blob, buffer;

      browserOnly(before)(() => fh.fetch('sample-image-small-one.png')
        .then((file) => {
          blob = file;

          return new Promise((resolve) => {
            /* global FileReader */
            const fileReader = new FileReader();
            fileReader.onload = function () {
              buffer = this.result;
              resolve();
            };
            fileReader.readAsArrayBuffer(blob);
          });
        }));

      nodeOnly(before)(() => fh.fetchWithoutMagic('sample-image-small-one.png')
        .then((file) => {
          buffer = file;
        }));

      browserOnly(it)('posts a file to a room by directly supplying its blob', () => spark.messages.create({
        roomId: room.id,
        file: blob
      })
        .then((message) => {
          assert.property(message, 'files');
          assert.isDefined(message.files);
          assert.isArray(message.files);
          assert.lengthOf(message.files, 1);
        }));

      // Disabling it gating pipelines because it failes a lot and we get
      // mostly adequate coverage via blob upload
      flaky(it)('posts a file to a room by directly supplying its buffer', () => spark.messages.create({
        roomId: room.id,
        file: buffer
      })
        .then((message) => {
          assert.property(message, 'files');
          assert.isDefined(message.files);
          assert.isArray(message.files);
          assert.lengthOf(message.files, 1);
        }));

      it('posts a file with a message to a room by specifying the file\'s url', () => spark.messages.create({
        roomId: room.id,
        file: KNOWN_HOSTED_IMAGE_URL,
        text: 'A File'
      })
        .then((message) => {
          assert.property(message, 'files');
          assert.isDefined(message.files);
          assert.isArray(message.files);
          assert.lengthOf(message.files, 1);

          assert.property(message, 'text');
        }));
    });

    describe('get()', () => {
      let message;

      before(() => spark.messages.create({
        roomId: room.id,
        text: 'A test message'
      })
        .then((m) => {
          message = m;
        }));

      it('returns a single message', () => spark.messages.get(message)
        .then((m) => {
          assert.isMessage(m);
          assert.deepEqual(m, message);
        }));
    });

    describe('#list()', () => {
      let room;
      before(() => spark.rooms.create({
        title: 'Room List Test'
      })
        .then((r) => {
          room = r;
        }));

      before(() => [1, 2, 3].reduce((promise, value) => promise.then(() => spark.messages.create({
        roomId: room.id,
        text: `message: ${value}`
      })), Promise.resolve()));

      it('returns all messages for a room', () => spark.messages.list({roomId: room.id})
        .then((messages) => {
          assert.isDefined(messages);
          assert.lengthOf(messages, 3);
          for (const message of messages) {
            assert.isMessage(message);
          }
        }));

      it('returns a bounded set of messages for a room', () => {
        const spy = sinon.spy();
        return spark.messages.list({roomId: room.id, max: 2})
          .then((messages) => {
            assert.lengthOf(messages, 2);
            return (function f(page) {
              for (const message of page) {
                spy(message.id);
              }

              if (page.hasNext()) {
                return page.next().then(f);
              }

              return Promise.resolve();
            }(messages));
          })
          .then(() => {
            assert.calledThrice(spy);
          });
      });
    });

    describe('#remove()', () => {
      let message;
      beforeEach(() => spark.messages.create({
        roomId: room.id,
        text: 'A test message'
      })
        .then((m) => {
          message = m;
        }));

      it('deletes a single message', () => spark.messages.remove(message)
        .then((body) => {
          assert.notOk(body);
          return assert.isRejected(spark.messages.get(message));
        })
        .then((reason) => {
          assert.instanceOf(reason, SparkHttpError.NotFound);
        }));
    });
  });
});

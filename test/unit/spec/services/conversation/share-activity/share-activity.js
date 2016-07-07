/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Conversation = require('../../../../../../src/client/services/conversation');
var MockSpark = require('../../../../lib/mock-spark');
var ShareActivity = require('../../../../../../src/client/services/conversation/share-activity');
var sinon = require('sinon');

var assert = chai.assert;

describe('Services', function() {
  describe('Conversation', function() {
    describe('Share Activity', function() {
      var spark;
      var conversation;
      var activity;
      var share;

      beforeEach(function() {
        spark = new MockSpark({
          children: {
            conversation: Conversation
          }
        });

        spark.request.returns(Promise.resolve({
          body: {
            objectType: 'normalObject'
          }
        }));

        spark.encryption = {
          encryptBinary: sinon.stub().returns(Promise.resolve({
            cblob: {},
            scr: {}
          }))
        };

        conversation = spark.conversation;
      });


      describe('#addFile', function() {
        var file1 = {
          clientTempId: 'file-1',
          name: 'test-1',
          type: 'image/png',
          size: '100'
        };

        var file2 = {
          clientTempId: 'file-2',
          name: 'test-2',
          type: 'image/png',
          size: '200'
        };

        beforeEach(function() {
          activity = {};

          share = new ShareActivity(activity, {
            parent: conversation,
            parse: true
          });

          share._processImage = sinon.stub().returns(Promise.resolve({
            dimensions: {},
            image: {}
          }));
        });

        it('adds pending file uploads to the files attribute', function() {
          assert.equal(share.files.length, 0);
          return share.addFile(file1)
            .then(function() {

              assert.equal(share.files.length, 1);
              assert.strictEqual(share.files[0], file1);

              return share.addFile(file2);
            })
            .then(function() {
              assert.equal(share.files.length, 2);
              assert.strictEqual(share.files[0], file1);
              assert.strictEqual(share.files[1], file2);
            });
        });

        it('merges duplicate pending files and returns the upload promise if present', function() {
          assert.equal(share.files.length, 0);
          var p1 = share.addFile(file1);
          var p2 = share.addFile(file1);
          assert.strictEqual(p1, p2);

          return Promise.all([p1, p2])
            .then(function() {
              assert.equal(share.files.length, 1);
              assert.strictEqual(share.files[0], file1);
            });
        });
      });


      describe('#addAvatarFile', function() {
        var file1 = {
          clientTempId: 'file-1',
          name: 'test-1',
          type: 'image/png',
          size: '100'
        };

        beforeEach(function() {
          activity = {
            verb: 'assign'
          };

          share = new ShareActivity(activity, {
            parent: conversation,
            parse: true
          });

        });

        it('adds pending file uploads to the files attribute', function() {
          assert.equal(share.files.length, 0);
          return share.addAvatarFile(file1)
            .then(function(item) {

              assert.equal(share.files.length, 1);
              assert.strictEqual(share.files[0], file1);
              assert.equal(item.clientTempId, file1.clientTempId);
              assert.equal(item.fileSize, file1.size);
              assert.equal(item.mimeType, file1.type);
              assert.equal(item.objectType, 'file');
              assert.isDefined(item.scr);

            });
        });

        it('merges duplicate pending files and returns the upload promise if present', function() {
          assert.equal(share.files.length, 0);
          var p1 = share.addAvatarFile(file1);
          var p2 = share.addAvatarFile(file1);
          assert.strictEqual(p1, p2);

          return Promise.all([p1, p2])
            .then(function(args) {
              var item = args[0];
              assert.equal(share.files.length, 1);
              assert.strictEqual(share.files[0], file1);
              assert.equal(item.clientTempId, file1.clientTempId);
              assert.equal(item.fileSize, file1.size);
              assert.equal(item.mimeType, file1.type);
              assert.equal(item.objectType, 'file');
              assert.isDefined(item.scr);

            });
        });
      });
    });
  });
});

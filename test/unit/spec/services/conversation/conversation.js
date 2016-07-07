/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Conversation = require('../../../../../src/client/services/conversation');
var isArray = require('lodash.isarray');
var MockSpark = require('../../../lib/mock-spark');
var patterns = require('../../../../../src/util/patterns');
var sinon = require('sinon');
var uuid = require('uuid');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Conversation', function() {

    var spark;
    var conversation;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          conversation: Conversation
        },
        config: {
          conversation: {
            keepEncryptedProperties: false
          }
        }
      });

      spark.request.returns(Promise.resolve({
        body: {
          objectType: 'normalObject',
          object: {
            files: {
              items: []
            }
          }
        }
      }));

      spark.encryption = {
        encryptBinary: sinon.stub().returns(Promise.resolve({
          cblob: {},
          scr: {}
        })),
        kms: {
          prepareRequest: sinon.stub().returns(Promise.resolve('slkdjfhglaskjhxfnlakfhbkavcrfgxnaksuybcgjwn'))
        }
      };

      spark.device.getServiceUrl = sinon.stub().returns('https://example.com');

      conversation = spark.conversation;
    });

    describe('#add()', function() {
      it('accepts participant emails and converts them to uuids', function() {
        var spy = sinon.spy(conversation, '_submitActivity');
        var u = uuid.v4();
        spark.user = {
          getUUID: sinon.stub().returns(u)
        };

        return conversation.add({
          url: 'http://conversation.example.com/1',
          defaultActivityEncryptionKeyUrl: 'http://kms.example.com/1',
          kmsResourceObjectUrl: 'http://kro.example.com/kro/1'
        }, {
          id: 'test@example.com'
        })
        .then(function() {
          assert.equal(spy.args[0][0].object.id, u);
        });
      });
    });

    describe('#create()', function() {
      var stubGrouped;
      var stubOneOnOne;

      beforeEach(function() {
        stubGrouped = sinon.stub(conversation, '_createGrouped').returns(Promise.resolve({}));
        stubOneOnOne = sinon.stub(conversation, '_maybeCreateOneOnOneThenPost').returns(Promise.resolve({}));
        conversation.outboundNormalizer = {
          normalize: sinon.stub().returns(Promise.resolve())
        };
        spark.user = {
          getUUID: function(ids) {
            if (isArray(ids)) {
              return Promise.all(ids.map(uuid.v4.bind(uuid)));
            }
            return Promise.resolve(uuid.v4());
          }
        };
      });

      it('accepts participant emails and converts them to uuids (1:1)', function() {
        return conversation.create({
          participants: [
            'test-create-grouped@example.com'
          ]
        })
          .then(function() {
            assert.match(stubOneOnOne.args[0][0].participants[0], patterns.uuid);
          });
      });

      it('accepts participant emails and converts them to uuids (grouped)', function() {
        return conversation.create({
          participants: [
            uuid.v4(),
            'test-create-grouped@example.com'
          ]
        })
          .then(function() {
            assert.match(stubGrouped.args[0][0].participants[0], patterns.uuid);
            assert.match(stubGrouped.args[0][0].participants[1], patterns.uuid);
          });
      });
    });

    describe('#post', function() {
      var comment;
      var encryptedComment;
      var content;
      var encryptedContent;

      beforeEach(function() {
        comment = 'test comment';
        encryptedComment = '*this is ciphertext*';
        content = '<spark-mention>test comment</spark-mention>';
        encryptedContent = '*this is cipherrichtext*';

        sinon.stub(conversation, '_encryptActivity', function(activity) {
          activity.object.displayName = encryptedComment;
          activity.object.content = encryptedContent;
          return activity;
        });

        sinon.stub(conversation, '_submitActivity', function(activity) {
          return activity;
        });

        sinon.stub(conversation.outboundNormalizer, '_normalizePerson', function(person) {
          return Promise.resolve(person);
        });
      });

      beforeEach(function() {
        return new Promise(function(resolve) {
          process.nextTick(function() {
            resolve();
          });
        });
      });

      afterEach(function() {
        conversation.config.keepEncryptedProperties = false;
      });

      it('removes encrypted properties by default', function() {
        return conversation.post({
          url: 'http://example.com/convo'
        }, {
          displayName: comment,
          content: content
        })
          .then(function(activity) {
            assert.equal(activity.object.displayName, comment);
            assert.equal(activity.object.content, content);
            assert.isUndefined(activity.object.encryptedDisplayName);
            assert.isUndefined(activity.object.encryptedContent);
          });
      });

      it('optionally keeps encrypted properties', function() {
        conversation.config.keepEncryptedProperties = true;
        return conversation.post({
          url: 'http://example.com/convo'
        }, {
          displayName: comment,
          content: content
        })
          .then(function(activity) {
            assert.equal(activity.object.displayName, comment);
            assert.equal(activity.object.content, content);
            assert.property(activity.object, 'encryptedDisplayName');
            assert.property(activity.object, 'encryptedContent');
            assert.equal(activity.object.encryptedDisplayName, encryptedComment);
            assert.equal(activity.object.encryptedContent, encryptedContent);
          });
      });
    });

    describe('#unassign()', function() {
      var convo;
      var activity;

      beforeEach(function() {
        convo = {
          url: 'http://example.com/convo'
        };

        activity = {
          object: {
            files: {
              items: []
            },
            objectType: 'content'
          },
          target: convo,
          verb: 'unassign'
        };

        sinon.stub(conversation, '_encryptActivity', function(activity) {
          activity.object = {
            files: {
              items: []
            }
          };
          return Promise.resolve(activity);
        });

        sinon.stub(conversation, '_submitActivity', function(activity) {
          return activity;
        });
      });

      it('submits unassign activity', function() {
        return conversation.unassign(convo, activity.object, activity)
          .then(function(retActivity) {
            assert.equal(retActivity.object.files.items.length, 0);
            assert.isUndefined(retActivity.object.displayName);
            assert.equal(retActivity.object.objectType, 'content');
            assert.equal(retActivity.verb, 'unassign');
          });
      });

      it('forces files.items to be empty array even if files.items is not empty', function() {
        activity.object.files.items.push({
          src: 'src'
        });
        return conversation.unassign(convo, activity.object, activity)
          .then(function(retActivity) {
            assert.equal(retActivity.object.files.items.length, 0);
            assert.isUndefined(retActivity.object.displayName);
            assert.equal(retActivity.object.objectType, 'content');
            assert.equal(retActivity.verb, 'unassign');
          });
      });
    });

    describe('#assign', function() {
      var scr;
      var encryptedScr;
      var convo;
      var activity;

      beforeEach(function() {
        scr = 'File SCR';
        encryptedScr = '*this is cipherSCR*';
        convo = {
          url: 'http://example.com/convo'
        };

        activity = {
          object: {
            files: {
              items: [
                {
                  scr: scr,
                  type: 'image/png'
                }
              ]
            },
            objectType: 'content',
            contentCategory: 'images'
          },
          target: convo,
          verb: 'assign'
        };

        sinon.stub(conversation, '_encryptActivity', function(activity) {
          activity.object = {
            files: {
              items: [
                {
                  scr: encryptedScr
                }
              ]
            },
            objectType: 'content',
            contentCategory: 'images'
          };
          return Promise.resolve(activity);
        });

        sinon.stub(conversation.outboundNormalizer, '_normalizePerson', function(person) {
          return Promise.resolve(person);
        });

        sinon.stub(conversation, '_submitActivity', function(activity) {
          return activity;
        });
      });

      it('submits assign activity', function() {
        return conversation.assign(convo, activity.object)
          .then(function(retActivity) {
            assert.equal(retActivity.object.files.items.length, 1);
            assert.isUndefined(retActivity.object.displayName);
            assert.equal(retActivity.object.objectType, 'content');
            assert.equal(retActivity.object.contentCategory, 'images');
            assert.equal(retActivity.verb, 'assign');
          });
      });

      it('requires files.items', function() {
        activity.object.files.items = [];
        var promise = conversation.assign(convo, activity.object);
        return assert.isRejected(promise, /Cannot submit share activity without files/);
      });

      it('requires files.items.length to equal 1', function() {
        activity.object.files.items = [
          {
            scr: 'scr'
          },
          {
            scr: 'scr'
          }
        ];
        var promise = conversation.assign(convo, activity.object);
        return assert.isRejected(promise, /only one file item is supported/);
      });

      it('requires files.items[0].fileSize to be < 1mb', function() {
        activity.object.files.items[0].size = 20000000;
        var promise = conversation.assign(convo, activity.object);
        return assert.isRejected(promise, /`activity.object.files\[0\].fileSize` must be less than 1mb/);
      });

      it('requires activity.object.contentCategory to be images', function() {
        activity.object.files.items[0].type = 'doc';
        var promise = conversation.assign(convo, activity.object);
        return assert.isRejected(promise, /`activity.object.contentCategory` must be `images`/);
      });

    });

    describe('#share()', function() {

      var comment;
      var encryptedComment;
      var content;
      var encryptedContent;
      var fileComment;
      var encryptedFileComment;
      var scr;
      var encryptedScr;
      var convo;
      var preppedActivity;
      var activity;

      beforeEach(function() {
        comment = 'test comment';
        encryptedComment = '*this is ciphertext*';
        content = '<spark-mention>test comment</spark-mention>';
        encryptedContent = '*this is cipherrichtext*';
        fileComment = 'file comment';
        encryptedFileComment = '*this is cipherfiletext*';
        scr = 'File SCR';
        encryptedScr = '*this is cipherSCR*';
        convo = {
          url: 'http://example.com/convo'
        };
        preppedActivity = {
          object: {
            files: {
              items: [
                {
                  displayName: fileComment,
                  scr: scr
                }
              ]
            },
            displayName: comment,
            content: content,
            objectType: 'content'
          }
        };

        activity = {
          prepare: function prepareShare() {return Promise.resolve(preppedActivity); },
          target: convo,
          verb: 'share',
          encryptedDisplayName: encryptedComment,
          encryptedContent: encryptedContent
        };

        sinon.stub(conversation, '_encryptActivity', function(activity) {
          activity.object = {
            files: {
              items: [
                {
                  displayName: encryptedFileComment,
                  scr: encryptedScr
                }
              ]
            },
            content: encryptedContent,
            displayName: encryptedComment
          };
          return Promise.resolve(activity);
        });

        sinon.stub(conversation.outboundNormalizer, '_normalizePerson', function(person) {
          return Promise.resolve(person);
        });

        sinon.stub(conversation, '_submitActivity', function(activity) {
          return activity;
        });
      });


      beforeEach(function() {
        return new Promise(function(resolve) {
          process.nextTick(function() {
            resolve();
          });
        });
      });

      afterEach(function() {
        conversation.config.keepEncryptedProperties = false;
      });

      it('requires files', function() {
        var promise = conversation.share(convo, {
          content: '<spark-mention>this is rich text</spark-mention>',
          files: [],
          objectType: 'content'
        });
        return assert.isRejected(promise, /`object.files` is required/);
      });

      it('removes encrypted properties by default', function() {
        return conversation.share(convo, {
          displayName: comment,
          content: content,
          files: []
        }, activity)
          .then(function(activity) {
            assert.equal(activity.object.displayName, comment);
            assert.equal(activity.object.content, content);
            assert.isUndefined(activity.object.encryptedDisplayName);
            assert.isUndefined(activity.object.encryptedContent);

            activity.object.files.items.forEach(function(file) {
              assert.equal(file.displayName, fileComment);
              assert.equal(file.scr, scr);
              assert.isUndefined(file.encryptedDisplayName);
              assert.isUndefined(file.encryptedScr);
            });
          });
      });

      it('optionally keeps encrypted properties', function() {
        conversation.config.keepEncryptedProperties = true;
        return conversation.share(convo, {
          displayName: comment,
          content: content,
          files: []
        }, activity)
          .then(function(activity) {
            assert.equal(activity.object.displayName, comment);
            assert.equal(activity.object.content, content);
            assert.property(activity.object, 'encryptedDisplayName');
            assert.property(activity.object, 'encryptedContent');
            assert.equal(activity.object.encryptedDisplayName, encryptedComment);
            assert.equal(activity.object.encryptedContent, encryptedContent);

            activity.object.files.items.forEach(function(file) {
              assert.equal(file.displayName, fileComment);
              assert.equal(file.scr, scr);
              assert.property(file, 'encryptedDisplayName');
              assert.property(file, 'encryptedScr');
              assert.equal(file.encryptedDisplayName, encryptedFileComment);
              assert.equal(file.encryptedScr, encryptedScr);
            });
          });
      });

    });

    describe('#update', function() {
      var encryptedTitle;
      var convo;

      beforeEach(function() {
        encryptedTitle = '*this is ciphertext*';
        convo = {
          url: 'http://example.com/convo',
          displayName: 'Renamed Test Converation'
        };

        sinon.stub(conversation, '_encryptActivity', function(activity) {
          activity.object.displayName = '*this is ciphertext*';
          return activity;
        });

        sinon.stub(conversation, '_submitActivity', function(activity) {
          return activity;
        });
      });

      afterEach(function() {
        conversation.config.keepEncryptedProperties = false;
      });

      it('removes encrypted displayNames by default', function() {
        return conversation.update(convo)
          .then(function(activity) {
            assert.equal(activity.object.displayName, convo.displayName);
            assert.isUndefined(activity.object.encryptedDisplayName);
            assert.isUndefined(convo.encryptedDisplayName);
          });
      });

      it('optionally keeps encrypted displayNames', function() {
        conversation.config.keepEncryptedProperties = true;
        return conversation.update(convo)
          .then(function(activity) {
            assert.equal(activity.object.displayName, convo.displayName);
            assert.property(activity.object, 'encryptedDisplayName');
            assert.equal(activity.object.encryptedDisplayName, encryptedTitle);
            assert.property(convo, 'encryptedDisplayName');
            assert.equal(convo.encryptedDisplayName, encryptedTitle);
          });
      });
    });

    describe('#_inferConversationUrl', function() {
      it('infers a conversation url for a conversation object that only has a conversation id', function() {
        return assert.deepEqual(conversation._inferConversationUrl({id: 'some-conversaton-id'}), {
          id: 'some-conversaton-id',
          url: 'https://example.com/conversations/some-conversaton-id'
        });
      });
    });

    describe('#_prepareActivity()', function() {
      it('does not remove the `mentions` property', function() {
        var activity = {
          _clientGeneratedMetaData: '*metadata*',
          objectType: 'activity',
          object: {
            objectType: 'comment',
            displayName: '*this is ciphertext*',
            displayNameHtml: '*this is plaintext*',
            mentions: {
              items: [
                {
                  id: '3dc6bb26-dedc-11e4-8c75-1681e6b88ec1',
                  objectType: 'person'
                }
              ]
            }
          },
          published: Date.now()
        };

        conversation._prepareActivity(activity, {verb: 'post'})
          .then(function(activity) {
            assert.deepEqual(activity.object.mentions, {
              items: [
                {
                  id: '3dc6bb26-dedc-11e4-8c75-1681e6b88ec1',
                  objectType: 'person'
                }
              ]
            });
          });
      });

      it('requires a `displayName` for activities with content', function() {
        var promise = conversation._prepareActivity(
        {},
        {
          verb: 'post',
          objectType: 'activity',
          object: {
            content: '<spark-mention>this is rich text</spark-mention>',
            objectType: 'comment'
          }
        });
        return assert.isRejected(promise, /Cannot submit activity object with `content` but no `displayName`/);
      });
    });

    describe('#_submitActivity()', function() {
      it('excludes unacceptable properties from submission to the API', function() {
        var activity = {
          _clientGeneratedMetaData: '*metadata*',
          objectType: 'activity',
          object: {
            objectType: 'comment',
            displayName: '*this is ciphertext*',
            displayNameHtml: '*this is plaintext*'
          },
          published: Date.now()
        };

        return conversation._submitActivity(activity)
          .then(function() {
            var requestOptions = spark.request.args[0][0];
            assert.deepEqual(requestOptions.body, {
              objectType: 'activity',
              object: {
                objectType: 'comment',
                displayName: '*this is ciphertext*'
              }
            });
          });
      });

      it('allows a mentions property to be sent to the server', function() {
        var activity = {
          _clientGeneratedMetaData: '*metadata*',
          objectType: 'activity',
          object: {
            objectType: 'comment',
            displayName: '*this is ciphertext*',
            displayNameHtml: '*this is plaintext*',
            mentions: {
              items: [
                {
                  id: '3dc6bb26-dedc-11e4-8c75-1681e6b88ec1',
                  objectType: 'person'
                }
              ]
            }
          },
          published: Date.now()
        };

        return conversation._submitActivity(activity)
          .then(function() {
            var requestOptions = spark.request.args[0][0];
            assert.deepEqual(requestOptions.body, {
              objectType: 'activity',
              object: {
                objectType: 'comment',
                displayName: '*this is ciphertext*',
                mentions: {
                  items: [
                    {
                      id: '3dc6bb26-dedc-11e4-8c75-1681e6b88ec1',
                      objectType: 'person'
                    }
                  ]
                }
              }
            });
          });
      });
    });
  });
});

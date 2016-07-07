/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var findLast = require('lodash.findlast');
var fh2 = require('../../../lib/fixtures-v2');
var flaky = require('../../../../lib/mocha-helpers').flaky;
var landingparty = require('../../../lib/landingparty');

describe('Services', function() {
  this.timeout(60000);

  describe('Encryption', function() {
    // This functionality is tested elsewhere, but with retry in event of swift
    // failures.
    describe('End to End', function() {
      var comment = 'if we go "by the book", like Lieutenant Saavik, hours could seem like days.';

      var party = {
        spock: true,
        mccoy: true,
        checkov: true
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      var conversationKey;
      var conversation;

      describe('Verb: Create', function() {
        it('creates a conversation with an encryption key', function() {
          return party.spock.spark.encryption.getUnusedKey()
            .then(function(key) {
              conversationKey = key;
              return party.spock.spark.request({
                method: 'POST',
                api: 'conversation',
                resource: 'conversations',
                body: {
                  displayName: 'Away Team Briefing',
                  activities: {
                    items: [
                      {
                        verb: 'create',
                        actor: {
                          objectType: 'person',
                          id: party.spock.id
                        }
                      },
                      {
                        verb: 'add',
                        actor: {
                          objectType: 'person',
                          id: party.spock.id
                        },
                        object: {
                          objectType: 'person',
                          id: party.spock.id
                        }
                      },
                      {
                        verb: 'add',
                        actor: {
                          objectType: 'person',
                          id: party.spock.id
                        },
                        object: {
                          objectType: 'person',
                          id: party.mccoy.id
                        }
                      },
                      {
                        verb: 'add',
                        actor: {
                          objectType: 'person',
                          id: party.spock.id
                        },
                        object: {
                          objectType: 'person',
                          id: party.checkov.id
                        }
                      }
                    ]
                  },
                  defaultActivityEncryptionKeyUrl: conversationKey.keyUrl
                }
              })
              .then(function(res) {
                conversation = res.body;
                assert.equal(conversation.defaultActivityEncryptionKeyUrl, conversationKey.keyUrl);
              });
            });
        });
      });

      describe('Verb: Post', function() {
        var ciphertext;
        it('encrypts the comment', function() {
          return party.spock.spark.encryption.encryptText(comment, conversationKey.keyUrl)
            .then(function(c) {
              ciphertext = c;
            });
        });

        it('submits an encrypted activity to the conversation', function() {
          return party.spock.spark.request({
            method: 'POST',
            api: 'conversation',
            resource: 'activities',
            body: {
              verb: 'post',
              target: {
                objectType: 'conversation',
                id: conversation.id
              },
              actor: {
                objectType: 'person',
                id: party.spock.id
              },
              object: {
                objectType: 'comment',
                displayName: ciphertext
              },
              encryptionKeyUrl: conversationKey.keyUrl
            }
          })
            .then(function(res) {
              var activity = res.body;
              assert.isNotNull(activity.encryptionKeyUrl);
              assert.notEqual(activity.object.displayName, comment);
            });
        });

        it('retrieves the conversation and decrypts the comment', function() {
          return party.mccoy.spark.request({
            uri: conversation.url
          })
            .then(function(res) {
              var conversation = res.body;
              var post = findLast(conversation.activities.items, {verb: 'post'});
              assert.equal(post.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);
              assert.isDefined(post.object.displayName);
              assert.isDefined(post.encryptionKeyUrl);
              return party.spock.spark.encryption.decryptText(post.object.displayName, post.encryptionKeyUrl);
            })
            .then(function(plaintext) {
              assert.equal(plaintext, comment);
            });
        });
      });

      // Marked as flaky because it doesn't do retries and SWIFT breaks a lot.
      // Everything this test covers is covered in actions.js
      flaky(describe)('Verb: Share', function() {
        // Note: This could be done in a single chain, but breaking it into
        // multiple tests helps explain what's going and and make it's easier to
        // debug the tests.
        var spaceUrl;
        var scr;
        var encryptedSourceFile;
        var uploadResponseBody;
        var encryptedScr;
        var encryptedFileName;
        var share;
        var encryptedResultFile;
        var realDownloadUrl;

        var fixtures = {
          sourceFile: 'sample-text-one.txt'
        };

        before(function fetchFixtures() {
          return fh2.fetchFixtures(fixtures);
        });

        it('gets the conversation space url', function() {
          return party.spock.spark.request({
            method: 'PUT',
            uri: conversation.url + '/space'
          })
            .then(function(res) {
              spaceUrl = res.body.spaceUrl;
            });
        });

        it('encrypts the file', function() {
          return party.spock.spark.encryption.encryptBinary(fixtures.sourceFile)
            .then(function(data) {
              scr = data.scr;
              encryptedSourceFile = data.cblob;
            });
        });

        it('uploads the encrypted file to the conversation\'s space', function() {
          return party.spock.spark.upload({
            uri: spaceUrl + '/upload_sessions',
            file: encryptedSourceFile,
            phases: {
              initialize: {
                fileSize: encryptedSourceFile.size || encryptedSourceFile.length || encryptedSourceFile.byteLength
              },
              upload: {
                $uri: function $uri(session) {
                  return session.uploadUrl;
                }
              },
              finalize: {
                $uri: function $uri(session) {
                  return session.finishUploadUrl;
                },
                body: {
                  path: fixtures.sourceFile.name,
                  fileSize: encryptedSourceFile.size || encryptedSourceFile.length || encryptedSourceFile.byteLength
                }
              }
            }
          })
            .then(function(res) {
              uploadResponseBody = res;
            });
        });

        it('adds the upload location to the scr and encrypts the scr with the conversation key', function() {
          scr.loc = uploadResponseBody.downloadUrl;
          return party.spock.spark.encryption.encryptScr(scr, conversation.defaultActivityEncryptionKeyUrl)
            .then(function(scr) {
              encryptedScr = scr;
            });
        });

        it('encrypts the file name', function() {
          return party.spock.spark.encryption.encryptText(fixtures.sourceFile.name, conversation.defaultActivityEncryptionKeyUrl)
            .then(function(ciphertext) {
              encryptedFileName = ciphertext;
            });
        });

        it('shares the activity to the conversation', function() {
          var body = {
            verb: 'share',
            encryptionKeyUrl: conversation.defaultActivityEncryptionKeyUrl,
            actor: {
              objectType: 'person',
              id: party.spock.id
            },
            object: {
              contentCategory: 'documents',
              displayName: encryptedFileName,
              objectType: 'content',
              files: {
                items: [
                  {
                    displayName: encryptedFileName,
                    fileSize: fixtures.sourceFile.size,
                    mimeType: fixtures.sourceFile.type,
                    objectType: 'file',
                    url: uploadResponseBody.downloadUrl,
                    scr: encryptedScr
                  }
                ]
              }
            },
            target: {
              id: conversation.id,
              objectType: 'conversation'
            }
          };

          return party.spock.spark.request({
            method: 'POST',
            api: 'conversation',
            resource: '/activities',
            body: body
          });

        });

        it('retrieves the newly shared activity from the conversation', function() {
          return party.spock.spark.request({
            uri: conversation.url
          })
            .then(function(res) {
              conversation = res.body;
              share = findLast(conversation.activities.items, {verb: 'share'});
            });
        });

        it('decrypts the activity\'s displayName', function() {
          return party.spock.spark.encryption.decryptText(share.object.displayName, share.encryptionKeyUrl)
            .then(function(displayName) {
              assert.equal(displayName, fixtures.sourceFile.name);
              share.object.displayName = displayName;
            });
        });

        it('decrypts the activity\'s scr', function() {
          return party.spock.spark.encryption.decryptScr(share.object.files.items[0].scr, share.encryptionKeyUrl)
            .then(function(resultScr) {
              share.object.files.items[0].scr = resultScr;

              var keys = [
                'enc',
                'key',
                'iv',
                'aad',
                'loc',
                'tag'
              ];

              for (var key in keys) {
                if (!Object.hasOwnProperty.call(keys, key)) {
                  assert.equal(resultScr[key], scr[key]);
                }
              }
            });
        });

        it('retrieves the real download url for the encrypted file', function() {
          // Thanks to CORS and redirects, we need to explicitly retrieve the
          // file's real download URL.

          return party.spock.spark.request({
            method: 'POST',
            api: 'files',
            resource: 'download/endpoints',
            body: {
              endpoints: [
                share.object.files.items[0].scr.loc
              ]
            }
          })
            .then(function(res) {
              realDownloadUrl = res.body.endpoints[share.object.files.items[0].scr.loc];
            });
        });

        it('retrieves the encrypted file', function() {
          return party.spock.spark.request({
            uri: realDownloadUrl,
            responseType: 'buffer',
            headers: {
              Authorization: null
            }
          })
            .then(function(res) {
              encryptedResultFile = res.body;
              return assert.eventually.isTrue(fh2.isMatchingFile(encryptedResultFile, encryptedSourceFile));
            });
        });

        it('decrypts the encrypted file', function() {
          return party.spock.spark.encryption.decryptBinary(encryptedResultFile, share.object.files.items[0].scr, {preferBlob: true})
            .then(function(decryptedBlob) {
              return assert.eventually.isTrue(fh2.isMatchingFile(decryptedBlob, fixtures.sourceFile));
            });
        });
      });

    });
  });
});

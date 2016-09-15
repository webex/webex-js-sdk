/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {Defer, patterns} from '@ciscospark/common';
import CiscoSpark, {SparkHttpError} from '@ciscospark/spark-core';
import makeLocalUrl from '@ciscospark/test-helper-make-local-url';
import fh from '@ciscospark/test-helper-file';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import {find, map} from 'lodash';
import uuid from 'uuid';
import {detect} from '@ciscospark/http-core';

describe(`Plugin : Conversation`, function() {
  this.timeout(20000);
  describe(`verbs`, () => {
    let checkov, mccoy, participants, spark, spock;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        [spock, mccoy, checkov] = participants = users;

        spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });

        mccoy.spark = new CiscoSpark({
          credentials: {
            authorization: mccoy.token
          }
        });

        return Promise.all([
          spark.mercury.connect(),
          mccoy.spark.mercury.connect()
        ]);
      }));

    after(() => Promise.all([
      spark.mercury.disconnect(),
      mccoy.spark.mercury.disconnect()
    ]));

    function makeEmailAddress() {
      return `spark-js-sdk--test-${uuid.v4()}@example.com`;
    }

    let conversation;
    beforeEach(() => {
      if (conversation) {
        return Promise.resolve();
      }

      return spark.conversation.create({participants})
        .then((c) => {conversation = c;});
    });

    describe(`#add()`, () => {
      let email;

      beforeEach(() => {email = makeEmailAddress();});

      beforeEach(() => spark.conversation.create({participants: [checkov]}, {forceGrouped: true})
        .then((c) => {conversation = c;}));

      it(`adds the specified user to the specified conversation`, () => spark.conversation.add(conversation, mccoy)
        .then((activity) => {
          assert.isActivity(activity);
          assert.property(activity, `kmsMessage`);
        }));

      it(`grants the specified user access to the conversation's key`, () => spark.conversation.post(conversation, {displayName: `PROOF!`})
        .then(() => spark.conversation.add(conversation, mccoy))
        .then(() => mccoy.spark.conversation.get(conversation, {activitiesLimit: 10}))
        .then((c) => {
          assert.isConversation(c);
          const activity = find(c.activities.items, {verb: `post`});
          assert.equal(activity.object.displayName, `PROOF!`);
        }));

      it(`sideboards a non-existent user`, () => spark.conversation.add(conversation, email)
        .then((activity) => {
          assert.isActivity(activity);
          return spark.conversation.get(conversation, {includeParticipants: true});
        })
        .then((c) => {
          assert.isConversation(c);
          const participant = find(c.participants.items, {emailAddress: email});
          assert.include(participant.tags, `SIDE_BOARDED`);
          assert.match(participant.id, patterns.uuid);
        }));
    });

    describe(`#leave()`, () => {
      afterEach(() => {conversation = null;});
      it(`removes the current user from the specified conversation`, () => spark.conversation.leave(conversation)
        .then((activity) => {
          assert.isActivity(activity);
          return assert.isRejected(spark.conversation.get(conversation));
        })
        .then((reason) => {
          assert.statusCode(reason, 404);
          return assert.isRejected(spark.encryption.kms.fetchKey({uri: conversation.defaultActivityEncryptionKeyUrl}));
        })
        .then((reason) => assert.equal(reason.status, 403)));

      it(`removes the specified user from the specified conversation`, () => spark.conversation.leave(conversation, mccoy)
        .then((activity) => {
          assert.isActivity(activity);
          return assert.isRejected(mccoy.spark.conversation.get(conversation));
        })
        .then((reason) => {
          assert.statusCode(reason, 404);
          return assert.isRejected(mccoy.spark.encryption.kms.fetchKey({uri: conversation.defaultActivityEncryptionKeyUrl}));
        })
        .then((reason) => assert.equal(reason.status, 403)));


      describe(`with deleted users`, () => {
        let redshirt;
        beforeEach(() => testUsers.create({count: 1})
          .then(([rs]) => {
            redshirt = rs;
            return spark.conversation.add(conversation, rs);
          }));

        it(`removes the specified deleted user from the specified conversation`, () => spark.conversation.leave(conversation, redshirt)
          .then(() => spark.conversation.get(conversation, {includeParticipants: true}))
          .then((c) => {
            assert.lengthOf(c.participants.items, 3);
            assert.notInclude(map(c.participants.items, `id`), redshirt.id);
          }));
      });
    });

    describe(`#post()`, () => {
      let message, richMessage;
      beforeEach(() => {
        message = `mccoy, THIS IS A TEST MESSAGE`;
        richMessage = `<spark-mention data-object-type="person" data-object-id="${mccoy.id}">mccoy</spark-mention>, THIS IS A TEST MESSAGE`;
      });

      it(`posts a comment to the specified conversation`, () => spark.conversation.post(conversation, {
        displayName: message
      })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.displayName, message);
        }));

      it(`posts a sticky to the specified conversation`, () => spark.request({
        service: `stickies`,
        resource: `pack`
      })
        .then((res) => spark.conversation.post(conversation, {
          location: res.body.pads[0].stickies[0].location,
          objectType: `imageURI`
        })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.location, res.body.pads[0].stickies[0].location);
        })));

      it(`updates the specified conversation's unread status`);

      it(`posts rich content to the specified conversation`, () => spark.conversation.post(conversation, {
        displayName: message,
        content: richMessage
      })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.displayName, message);
          assert.equal(activity.object.content, richMessage);
        }));

      it(`submits mentions specified conversation`, () => spark.conversation.post(conversation, {
        displayName: message,
        content: richMessage,
        mentions: {
          items: [{
            id: mccoy.id,
            objectType: `person`
          }]
        }
      })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.displayName, message);
          assert.equal(activity.object.content, richMessage);

          assert.isDefined(activity.object.mentions);
          assert.isDefined(activity.object.mentions.items);
          assert.lengthOf(activity.object.mentions.items, 1);
          assert.equal(activity.object.mentions.items[0].id, mccoy.id);
        }));
    });

    describe(`#share()`, () => {
      let hashTestText = `#test.txt`;
      let sampleImageSmallOnePng = `sample-image-small-one.png`;
      let sampleImageSmallTwoPng = `sample-image-small-two.png`;
      let sampleImageLargeJpg = `sample-image-large.jpg`;
      let samplePowerpointTwoPagePpt = `sample-powerpoint-two-page.ppt`;
      let sampleTextOne = `sample-text-one.txt`;
      let sampleTextTwo = `sample-text-two.txt`;

      before(() => Promise.all([
        fh.fetch(hashTestText),
        fh.fetch(sampleImageSmallOnePng),
        fh.fetch(sampleImageSmallTwoPng),
        fh.fetch(sampleImageLargeJpg),
        fh.fetch(samplePowerpointTwoPagePpt),
        fh.fetch(sampleTextOne),
        fh.fetch(sampleTextTwo)
      ])
        .then((res) => {
          [
            hashTestText,
            sampleImageSmallOnePng,
            sampleImageSmallTwoPng,
            sampleImageLargeJpg,
            samplePowerpointTwoPagePpt,
            sampleTextOne,
            sampleTextTwo
          ] = res;
          assert.equal(samplePowerpointTwoPagePpt.type, `application/vnd.ms-powerpoint`);
        }));

      it(`shares the specified file to the specified conversation`, () => spark.conversation.share(conversation, {files: [sampleTextOne]})
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);
          return spark.conversation.download(activity.object.files.items[0]);
        })
        .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, sampleTextOne))));

      it(`shares the specified set of files to the specified conversation`, () => spark.conversation.share(conversation, {files: [sampleTextOne, sampleTextTwo]})
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);
          assert.isFileItem(activity.object.files.items[1]);
          return Promise.all([
            spark.conversation.download(activity.object.files.items[0]),
            spark.conversation.download(activity.object.files.items[1])
          ]);
        })
        .then(([file0, file1]) => Promise.all([
          assert.eventually.isTrue(fh.isMatchingFile(file0, sampleTextOne)),
          assert.eventually.isTrue(fh.isMatchingFile(file1, sampleTextTwo))
        ])));

      describe(`files with special characters`, () => {
        it(`shares the specified file to the specified conversation`, () => spark.conversation.share(conversation, {files: [hashTestText]})
          .then((activity) => {
            assert.isActivity(activity);
            assert.isEncryptedActivity(activity);
            assert.isFileItem(activity.object.files.items[0]);
            return spark.conversation.download(activity.object.files.items[0]);
          })
          .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, hashTestText))));
      });

      it(`shares the specified image to the specified conversation`, () => spark.conversation.share(conversation, {files: [sampleImageLargeJpg]})
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);

          const fileItem = activity.object.files.items[0];
          assert.isFileItem(fileItem);

          const thumbnailItem = activity.object.files.items[0].image;
          assert.isThumbnailItem(thumbnailItem);
          assert.equal(thumbnailItem.width, 640);
          assert.isAbove(thumbnailItem.height, 358);
          assert.isBelow(thumbnailItem.height, 361);

          return spark.conversation.download(activity.object.files.items[0]);
        })
        .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, sampleImageLargeJpg))));

      it(`shares the specified set of images the specified conversation`, () => spark.conversation.share(conversation, {files: [sampleImageSmallOnePng, sampleImageSmallTwoPng]})
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);
          assert.isFileItem(activity.object.files.items[1]);
          assert.isThumbnailItem(activity.object.files.items[0].image);
          assert.isThumbnailItem(activity.object.files.items[1].image);
          return Promise.all([
            spark.conversation.download(activity.object.files.items[0]),
            spark.conversation.download(activity.object.files.items[1])
          ]);
        })
        .then(([file0, file1]) => Promise.all([
          assert.eventually.isTrue(fh.isMatchingFile(file0, sampleImageSmallOnePng)),
          assert.eventually.isTrue(fh.isMatchingFile(file1, sampleImageSmallTwoPng))
        ])));

      describe(`when it shares a transcodable file`, () => {
        let activities;
        let blockUntilTranscode;
        let clientTempId;
        let objectUrl;

        beforeEach(() => {
          clientTempId = uuid.v4();
          activities = [];
          spark.mercury.on(`event:conversation.activity`, onMessage);
          blockUntilTranscode = new Defer();
        });

        afterEach(() => {
          spark.mercury.off(`event:conversation.activity`, onMessage);
        });

        function onMessage(message) {
          activities.push(message.data.activity);

          if (message.data.activity.clientTempId === clientTempId) {
            objectUrl = message.data.activity.object.url;
          }

          if (objectUrl) {
            const updateActivity = find(activities, (activity) => {
              return activity.verb === `update` && activity.object.url === objectUrl;
            });
            if (updateActivity) {
              blockUntilTranscode.resolve(updateActivity);
            }
          }
        }

        it(`mercury receives an update`, () => spark.conversation.share(conversation, {files: [samplePowerpointTwoPagePpt]}, {clientTempId})
          .then((activity) => {
            assert.equal(activity.clientTempId, clientTempId);
            activities.push(activity);
            return blockUntilTranscode.promise
              .then((updateActivity) => {
                assert.equal(updateActivity.object.url, activity.object.url);
                assert.lengthOf(updateActivity.object.files.items[0].transcodedCollection.items[0].files.items, 3);
              });
          }));
      });
    });

    describe(`#buildShare()`, () => {
      it(`makes an object compatible with #share() that emits file upload events`);
      describe(`Share`, () => {
        it(`emits upload events for each uploading file`);
        it(`removes uploaded files from the final activity`);
      });
    });

    describe(`#updateKey()`, () => {
      beforeEach(() => spark.conversation.create({participants, comment: `THIS IS A COMMENT`})
        .then((c) => {conversation = c;}));

      it(`assigns an unused key to the specified conversation`, () => spark.conversation.updateKey(conversation)
        .then((activity) => {
          assert.isActivity(activity);
          return spark.conversation.get(conversation);
        })
        .then((c) => {
          assert.isDefined(c.defaultActivityEncryptionKeyUrl);
          assert.notEqual(c.defaultActivityEncryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);
        }));

      it(`assigns the specified key to the specified conversation`, () => spark.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => spark.conversation.updateKey(conversation, key)
          .then((activity) => {
            assert.isActivity(activity);
            console.log(activity);
            assert.equal(activity.object.defaultActivityEncryptionKeyUrl, key.uri);
            return spark.conversation.get(conversation);
          })
          .then((c) => {
            assert.isDefined(c.defaultActivityEncryptionKeyUrl);
            assert.notEqual(c.defaultActivityEncryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);
          })));

      it(`grants access to the key for all users in the conversation`, () => spark.conversation.updateKey(conversation)
        .then((activity) => {
          assert.isActivity(activity);
          return mccoy.spark.conversation.get({
            url: conversation.url,
            participantsLimit: 0,
            activitiesLimit: 0
          });
        })
        .then((c) => {
          assert.isDefined(c.defaultActivityEncryptionKeyUrl);
          assert.notEqual(c.defaultActivityEncryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);
          return mccoy.spark.encryption.kms.fetchKey({uri: c.defaultActivityEncryptionKeyUrl});
        }));
    });

    describe(`verbs that update conversation tags`, () => {
      [
        {
          itString: `favorites the specified conversation`,
          tag: `FAVORITE`,
          verb: `favorite`
        },
        {
          itString: `hides the specified conversation`,
          tag: `HIDDEN`,
          verb: `hide`
        },
        {
          itString: `locks the specified conversation`,
          tag: `LOCKED`,
          verb: `lock`
        },
        {
          itString: `mutes the specified conversation`,
          tag: `MUTED`,
          verb: `mute`
        }
      ].forEach(({tag, verb, itString}) => {
        describe(`#${verb}()`, () => {
          it(itString, () => spark.conversation[verb](conversation)
            .then((activity) => {
              assert.isActivity(activity);
            })
            .then(() => spark.conversation.get(conversation))
            .then((c) => assert.include(c.tags, tag)));
        });
      });

      [
        {
          itString: `unfavorites the specified conversation`,
          setupVerb: `favorite`,
          tag: `FAVORITE`,
          verb: `unfavorite`
        },
        {
          itString: `unhides the specified conversation`,
          setupVerb: `hide`,
          tag: `HIDDEN`,
          verb: `unhide`
        },
        {
          itString: `unlocks the specified conversation`,
          setupVerb: `lock`,
          tag: `LOCKED`,
          verb: `unlock`
        },
        {
          itString: `unmutes the specified conversation`,
          setupVerb: `mute`,
          tag: `MUTED`,
          verb: `unmute`
        }
      ].forEach(({tag, verb, itString, setupVerb}) => {
        describe(`#${verb}()`, () => {
          beforeEach(() => spark.conversation[setupVerb](conversation)
            .catch((reason) => {
              if (reason.statusCode !== 403) {
                throw reason;
              }
            }));

          it(itString, () => spark.conversation[verb](conversation)
            .then((activity) => {
              assert.isActivity(activity);
            })
            .then(() => spark.conversation.get(conversation))
            .then((c) => assert.notInclude(c.tags, tag)));
        });
      });
    });

    describe(`verbs that update objects`, () => {
      let conversation;
      before(() => {
        if (!conversation) {
          return spark.conversation.create({displayName: `displayName`, participants})
            .then((c) => {
              conversation = c;
            });
        }

        return Promise.resolve();
      });

      describe(`#acknowledge()`, () => {
        it(`acknowledges the specified activity`, () => spark.conversation.post(conversation, {displayName: `A comment to acknowledge`})
          .then((activity) => mccoy.spark.conversation.acknowledge(conversation, activity))
          .then((ack) => spark.conversation.get(conversation, {activitiesLimit: 1})
            .then((c) => assert.equal(c.activities.items[0].url, ack.object.url))));
      });

      describe(`#assignModerator()`, () => {
        it(`assigns a moderator to a conversation`, () => spark.conversation.assignModerator(conversation, spock)
          .then(() => spark.conversation.get(conversation, {
            activitiesLimit: 5,
            includeParticipants: true
          }))
          .then((c) => {
            const moderators = c.participants.items.filter((p) => p.roomProperties && p.roomProperties.isModerator);
            assert.lengthOf(moderators, 1);
            assert.equal(moderators[0].id, spock.id);
          }));
      });

      describe(`#delete()`, () => {
        it(`deletes the current user's content`, () => spark.conversation.post(conversation, {displayName: `Delete Me 1`})
          .then((a) => spark.conversation.delete(conversation, a))
          .then(() => new Promise((resolve) => setTimeout(resolve, 2000)))
          .then(() => spark.conversation.get(conversation, {activitiesLimit: 2}))
          .then((c) => {
            assert.equal(c.activities.items[0].verb, `tombstone`);
            assert.equal(c.activities.items[1].verb, `delete`);
          }));

        describe(`when the current user is a moderator`, () => {
          it(`deletes any user's content`, () => spark.conversation.assignModerator(conversation)
            .catch(allowConflicts)
            .then(() => spark.conversation.lock(conversation))
            .catch(allowConflicts)
            .then(() => mccoy.spark.conversation.post(conversation, {displayName: `Delete Me 2`}))
            .then((a) => spark.conversation.delete(conversation, a)));
        });

        describe(`when the current user is not a moderator`, () => {
          it(`fails to delete other users' content`, () => spark.conversation.assignModerator(conversation)
            .catch(allowConflicts)
            .then(() => spark.conversation.lock(conversation))
            .catch(allowConflicts)
            .then(() => spark.conversation.post(conversation, {displayName: `Delete Me 3`}))
            .then((a) => assert.isRejected(mccoy.spark.conversation.delete(conversation, a)))
            .then((reason) => assert.instanceOf(reason, SparkHttpError.Forbidden)));
        });
      });

      describe(`#unassignModerator()`, () => {
        it(`removes a moderator from a conversation`, () => spark.conversation.assignModerator(conversation, spock)
          .catch(allowConflicts)
          .then(() => spark.conversation.unassignModerator(conversation, spock))
          .then(() => spark.conversation.get(conversation, {
            activitiesLimit: 5,
            includeParticipants: true
          }))
          .then((c) => {
            const moderators = c.participants.items.filter((p) => p.roomProperties && p.roomProperties.isModerator);
            assert.lengthOf(moderators, 0);
          }));
      });

      describe(`#update()`, () => {
        it(`renames the specified conversation`, () => spark.conversation.update(conversation, {
          displayName: `displayName2`,
          objectType: `conversation`
        })
          .then((c) => spark.conversation.get({url: c.target.url}))
          .then((c) => assert.equal(c.displayName, `displayName2`)));
      });
    });
  });
});

function allowConflicts(reason) {
  if (!(reason instanceof SparkHttpError.BadRequest)) {
    throw reason;
  }
}

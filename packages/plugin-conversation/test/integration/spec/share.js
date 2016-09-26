/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {Defer} from '@ciscospark/common';
import CiscoSpark from '@ciscospark/spark-core';
import fh from '@ciscospark/test-helper-file';
import sinon from '@ciscospark/test-helper-sinon';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import {find} from 'lodash';
import uuid from 'uuid';
import {skipInNode} from '@ciscospark/test-helper-mocha';

describe(`plugin-conversation`, function() {
  this.timeout(20000);
  describe(`verbs`, () => {
    let mccoy, participants, spark, spock;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        [spock, mccoy] = participants = users;

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

    let conversation;
    beforeEach(() => {
      if (conversation) {
        return Promise.resolve();
      }

      return spark.conversation.create({participants})
        .then((c) => {conversation = c;});
    });

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

    describe(`#share()`, () => {
      it(`shares the specified file to the specified conversation`, () => spark.conversation.share(conversation, [sampleTextOne])
        .then((activity) => {
          assert.isActivity(activity);
          assert.isEncryptedActivity(activity);
          assert.isFileItem(activity.object.files.items[0]);
          return spark.conversation.download(activity.object.files.items[0]);
        })
        .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, sampleTextOne))));

      it(`shares the specified set of files to the specified conversation`, () => spark.conversation.share(conversation, [sampleTextOne, sampleTextTwo])
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
        it(`shares the specified file to the specified conversation`, () => spark.conversation.share(conversation, [hashTestText])
          .then((activity) => {
            assert.isActivity(activity);
            assert.isEncryptedActivity(activity);
            assert.isFileItem(activity.object.files.items[0]);
            return spark.conversation.download(activity.object.files.items[0]);
          })
          .then((f) => assert.eventually.isTrue(fh.isMatchingFile(f, hashTestText))));
      });

      it(`shares the specified image to the specified conversation`, () => spark.conversation.share(conversation, [sampleImageLargeJpg])
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

      it(`shares the specified set of images the specified conversation`, () => spark.conversation.share(conversation, [sampleImageSmallOnePng, sampleImageSmallTwoPng])
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

        it(`mercury receives an update`, () => spark.conversation.share(conversation, {
          object: {
            files: [samplePowerpointTwoPagePpt]
          },
          clientTempId
        })
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

    describe(`#makeShare`, () => {
      // http-core doesn't current do upload progress events in node, so this
      // test is browser-only for now
      skipInNode(it)(`provides an interface for file upload events`, () => {
        const spy = sinon.spy();
        const share = spark.conversation.makeShare(conversation);
        const emitter = share.add(sampleImageSmallOnePng);
        emitter.on(`progress`, spy);
        return spark.conversation.share(conversation, share)
          .then(() => assert.called(spy));
      });

      it(`shares a file with a name`, () => {
        const share = spark.conversation.makeShare(conversation);
        share.add(sampleImageSmallOnePng);
        share.displayName = `a name`;
        return spark.conversation.share(conversation, share)
          .then((activity) => {
            assert.equal(activity.object.displayName, `a name`);
            return spark.conversation.download(activity.object.files.items[0]);
          })
          .then((file) => fh.isMatchingFile(file, sampleImageSmallOnePng));
      });

      it(`allows removal of a file from the share`, () => {
        const share = spark.conversation.makeShare(conversation);
        share.add(sampleImageSmallOnePng);
        share.add(sampleImageSmallTwoPng);
        share.remove(sampleImageSmallOnePng);
        share.displayName = `a name`;
        return spark.conversation.share(conversation, share)
          .then((activity) => {
            assert.equal(activity.object.displayName, `a name`);
            assert.lengthOf(activity.object.files.items, 1);
            return spark.conversation.download(activity.object.files.items[0]);
          })
          .then((file) => fh.isMatchingFile(file, sampleImageSmallTwoPng));
      });
    });
  });
});
